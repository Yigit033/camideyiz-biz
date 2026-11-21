import {assertISODate} from './diyanet.ts';
import {PRAYER_KEYS,timeToMinutes,type PrayerTime} from './prayer.ts';
import type {PublishedCalendarProvider} from './mirrorCalendar.ts';

export const CALENDAR30_LENGTH=30;
export type Calendar30Provider=PublishedCalendarProvider|'diyanet-awqat-salah';
export type Calendar30Day={
  dateISO:string;cityId:number;hijriDate:string|null;times:readonly PrayerTime[];
  provider:Calendar30Provider;fetchedAt:string;
};
export type Calendar30Snapshot={
  cityId:number;startISO:string;fetchedAt:string;
  days:readonly (Calendar30Day|null)[];
};
const LABELS=['İmsak','Güneş','Öğle','İkindi','Akşam','Yatsı'] as const;
const CORE=['imsak','gunes','ogle','ikindi','aksam','yatsi'] as const;
const BACKUP=['Imsak','Gunes','Ogle','Ikindi','Aksam','Yatsi'] as const;
function rec(value:unknown):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid calendar row');
  return value as Record<string,unknown>;
}
export function shiftCalendarDate(dateISO:string,days:number):string{
  return new Date(Date.parse(assertISODate(dateISO)+'T12:00:00Z')+days*86_400_000).toISOString().slice(0,10);
}
function parseDay(raw:unknown,provider:Calendar30Provider,cityId:number,fetchedAt:string):Calendar30Day{
  const row=rec(raw);
  const iso=provider==='diyanet-awqat-salah'?row.dateISO:
    provider==='idamedya'?row.tarih:row.MiladiTarihKisa;
  let dateISO:string;
  if(provider==='mtopal'||provider==='emushaf'){
    if(typeof iso!=='string'||!/^\d{2}\.\d{2}\.\d{4}$/.test(iso))
      throw new Error('Invalid published date format');
    dateISO=assertISODate(iso.slice(6,10)+'-'+iso.slice(3,5)+'-'+iso.slice(0,2));
  }else if(typeof iso==='string')dateISO=assertISODate(iso);
  else throw new Error('Missing published calendar date');
  const times:PrayerTime[]=CORE.map((key,i)=>{
    const value=provider==='diyanet-awqat-salah'
      ?(Array.isArray(row.times)?(row.times[i] as {time?:unknown;key?:unknown})?.time:null)
      :row[provider==='idamedya'?key:BACKUP[i]];
    if(typeof value!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
      throw new Error('Invalid published clock '+key);
    if(provider==='diyanet-awqat-salah' && (
      !Array.isArray(row.times)||(row.times[i] as {key?:unknown})?.key!==PRAYER_KEYS[i]))
      throw new Error('Wrong official prayer clock order');
    return {key:PRAYER_KEYS[i],label:LABELS[i],time:value};
  });
  for(let i=1;i<6;i++)if(timeToMinutes(times[i].time)<=timeToMinutes(times[i-1].time))
    throw new Error('Non-increasing published prayer clocks');
  if(provider==='diyanet-awqat-salah' && (
    row.cityId!==cityId||row.source!=='diyanet-awqat-salah'||row.timezone!=='Europe/Istanbul'))
    throw new Error('Official calendar district or source mismatch');
  const hijri=provider==='diyanet-awqat-salah'?row.hijriDate:
    provider==='idamedya'?row.hicri:row.HicriTarihUzun;
  if(hijri!==null&&hijri!==undefined&&(typeof hijri!=='string'||hijri.length>120))
    throw new Error('Invalid Hijri date');
  return {dateISO,cityId,provider,hijriDate:typeof hijri==='string'?hijri:null,fetchedAt,times};
}
/** Convert one published response into an independent, bounded 30-day calendar.
 * The primary mirror response explicitly identifies its Diyanet district;
 * the backup is requested ONLY at /vakitler/{selectedDistrictId}.
 */
export function parseCalendar30Source(raw:unknown,provider:Calendar30Provider,
  cityId:number,startISO:string,fetchedAt:string):Calendar30Snapshot{
  assertISODate(startISO);
  if(!Number.isSafeInteger(cityId)||cityId<1||cityId>1_000_000)
    throw new Error('Invalid calendar district id');
  if(!Number.isFinite(Date.parse(fetchedAt)))throw new Error('Invalid calendar fetch timestamp');
  let rows:unknown;
  if(provider==='idamedya'){
    const outer=rec(raw),payload=rec(outer.data);
    if(payload.ilce!==cityId||payload.kaynak!=='Diyanet İşleri Başkanlığı')
      throw new Error('Calendar source or district mismatch');
    rows=payload.gunler;
  }else rows=raw;
  const max=provider==='mtopal'?370:provider==='diyanet-awqat-salah'?35:45;
  if(!Array.isArray(rows)||rows.length<1||rows.length>max)
    throw new Error('Invalid published calendar list');
  const found=new Map<string,Calendar30Day>();
  for(const row of rows){
    const day=parseDay(row,provider,cityId,fetchedAt);
    if(found.has(day.dateISO))throw new Error('Duplicate published calendar date');
    found.set(day.dateISO,day);
  }
  return {cityId,startISO,fetchedAt,days:Array.from({length:CALENDAR30_LENGTH},(_,i)=>
    found.get(shiftCalendarDate(startISO,i))??null)};
}
/** Prefer an already verified source for each DATE; never mix prayer times
 * within a day or invent a missing boundary.
 */
export function mergeCalendar30(snapshots:readonly Calendar30Snapshot[]):Calendar30Snapshot{
  if(!snapshots.length)throw new Error('Missing calendar responses');
  const {cityId,startISO}=snapshots[0];
  if(snapshots.some(s=>s.cityId!==cityId||s.startISO!==startISO||
    s.days.length!==CALENDAR30_LENGTH))throw new Error('Calendar snapshots do not match');
  return {cityId,startISO,fetchedAt:snapshots[0].fetchedAt,
    days:Array.from({length:CALENDAR30_LENGTH},(_,i)=>{
      const day=snapshots.map(s=>s.days[i]).find((d):d is Calendar30Day=>d!==null)??null;
      if(day && (day.cityId!==cityId||day.dateISO!==shiftCalendarDate(startISO,i)))
        throw new Error('Calendar cross-day cache corruption');
      return day;
    })};
}
export function validateCalendar30Cache(raw:unknown,cityId:number,startISO:string,
  now:number,maxAgeMs=24*60*60*1000):Calendar30Snapshot{
  const value=rec(raw);
  if(value.cityId!==cityId||value.startISO!==assertISODate(startISO)||
    !Array.isArray(value.days)||value.days.length!==CALENDAR30_LENGTH||
    typeof value.fetchedAt!=='string')throw new Error('Calendar cache identity mismatch');
  const stamp=Date.parse(value.fetchedAt);
  if(!Number.isFinite(stamp)||stamp>now+60_000||now-stamp>maxAgeMs)
    throw new Error('Calendar cache expired');
  const days=value.days as unknown[];
  const safe: (Calendar30Day|null)[]=days.map((d,i)=>{
    if(d===null)return null;
    const v=rec(d);
    if(v.cityId!==cityId||v.dateISO!==shiftCalendarDate(startISO,i)||
      !['idamedya','mtopal','emushaf','diyanet-awqat-salah'].includes(String(v.provider))||
      !Array.isArray(v.times)||v.times.length!==6)throw new Error('Cached calendar row mismatch');
    const parsed=parseDay({
      dateISO:v.dateISO,tarih:v.dateISO,
      MiladiTarihKisa:v.dateISO.slice(8,10)+'.'+v.dateISO.slice(5,7)+'.'+v.dateISO.slice(0,4),
      times:v.times,source:'diyanet-awqat-salah',timezone:'Europe/Istanbul',cityId,
      hicriDate:v.hijriDate,hicri:v.hijriDate,HicriTarihUzun:v.hijriDate,
      ...Object.fromEntries(CORE.map((key,k)=>[key,(v.times as PrayerTime[])[k]?.time])),
      ...Object.fromEntries(BACKUP.map((key,k)=>[key,(v.times as PrayerTime[])[k]?.time])),
    },v.provider as Calendar30Provider,cityId,value.fetchedAt as string);
    return parsed;
  });
  return {cityId,startISO,fetchedAt:value.fetchedAt as string,days:safe};
}
export function calendar30Coverage(snapshot:Calendar30Snapshot):number{
  return snapshot.days.filter(Boolean).length;
}
