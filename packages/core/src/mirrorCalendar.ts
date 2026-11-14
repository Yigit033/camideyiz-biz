import {PRAYER_KEYS,timeToMinutes,type PrayerSchedule,type PrayerTime} from './prayer.ts';
import {assertISODate} from './diyanet.ts';
import {type PrayerPhase,calculatePrayerPhase,type Urgency} from './timeline.ts';
import {calculateVerifiedPhase} from './verifiedSchedule.ts';

export const MIRROR_SOURCE='idamedya-diyanet-republished' as const;
export const MIRROR_CACHE_MS=55*60*1000;
export const DEFAULT_MIRROR_PLACE={
  id:9541,name:'İstanbul',stateId:539,stateName:'İstanbul',
} as const; // Open public list (idamedya.org/api/v1/namaz/iller); NOT GPS-derived.

const LABELS=['İmsak','Güneş','Öğle','İkindi','Akşam','Yatsı'] as const;
function object(value:unknown):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid mirror payload');
  return value as Record<string,unknown>;
}
function validId(n:unknown):n is number{
  return Number.isSafeInteger(n)&&typeof n==='number'&&n>0&&n<=1_000_000;
}
function name(value:unknown):string{
  if(typeof value!=='string'||value.length<2||value.length>100||!value.trim())throw new Error('Invalid location label');
  return value.trim();
}
function envelope(raw:unknown):unknown{
  const payload=object(raw);
  if(payload.ok!==true||payload.data===undefined)throw new Error('Mirror returned an unsuccessful response');
  return payload.data;
}
export type MirrorState={id:number;name:string;country_id:2;centerDistrictId:number};
export type MirrorCity={id:number;name:string;state_id:number};
export function parseMirrorStates(raw:unknown):MirrorState[]{
  const items=envelope(raw);
  if(!Array.isArray(items)||items.length<1||items.length>100)throw new Error('Invalid state list');
  const used=new Set<number>();
  const out:MirrorState[]=[];
  for(const row of items){
    const o=object(row);
    if(!validId(o.sehir)||!validId(o.ilce))throw new Error('Invalid state IDs');
    if(used.has(o.sehir))throw new Error('Duplicate state ID');
    used.add(o.sehir);
    out.push({id:o.sehir,name:name(o.ad),country_id:2,centerDistrictId:o.ilce});
  }
  return out.sort((a,b)=>a.name.localeCompare(b.name,'tr'));
}
export function parseMirrorCities(raw:unknown,stateId:number):MirrorCity[]{
  if(!validId(stateId))throw new Error('Invalid state');
  const items=envelope(raw);
  if(!Array.isArray(items)||items.length<1||items.length>300)throw new Error('Invalid district list');
  const used=new Set<number>();
  return items.map(row=>{
    const o=object(row);
    if(!validId(o.ilce)||used.has(o.ilce))throw new Error('Invalid district ID');
    used.add(o.ilce);
    return {id:o.ilce,name:name(o.ad),state_id:stateId};
  }).sort((a,b)=>a.name.localeCompare(b.name,'tr'));
}
function shiftedDate(date:string,delta:number):string{
  return new Date(Date.parse(assertISODate(date)+'T12:00:00Z')+delta*86400000).toISOString().slice(0,10);
}
export type MirrorPrayerDay=PrayerSchedule&{
  source:typeof MIRROR_SOURCE;
  cityId:number;
  hijriDate:string|null;
  fetchedAt:string;
};
export type MirrorTriplet={
  source:typeof MIRROR_SOURCE;
  dateISO:string;
  city:{id:number;name:string;state_id:number};
  previous:MirrorPrayerDay|null;
  /** Forward-looking published calendar entries for OS-local alerts and widgets. */
  upcoming:readonly MirrorPrayerDay[];
  today:MirrorPrayerDay;
  next:MirrorPrayerDay;
};
function parseDay(raw:unknown,cityId:number,locationName:string,fetchTime:string):MirrorPrayerDay{
  const row=object(raw);
  const dateISO=assertISODate(row.tarih as string);
  const keys=['imsak','gunes','ogle','ikindi','aksam','yatsi'];
  const times:PrayerTime[]=keys.map((key,i)=>{
    const str=row[key];
    if(typeof str!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(str))
      throw new Error('Invalid ' + key + ' in mirror schedule');
    return {key:PRAYER_KEYS[i],label:LABELS[i],time:str};
  });
  for(let i=1;i<times.length;i++){
    if(timeToMinutes(times[i].time)<=timeToMinutes(times[i-1].time))
      throw new Error('Non-increasing prayer times');
  }
  const h=row.hicri;
  if(h!==null&&h!==undefined&&(typeof h!=='string'||h.length>90))
    throw new Error('Invalid Hijri text');
  return {dateISO,timezone:'Europe/Istanbul',locationName,isDemo:false,
    source:MIRROR_SOURCE,cityId,hijriDate:typeof h==='string'?h:null,
    fetchedAt:fetchTime,times};
}
export function parseMirrorTriplet(raw:unknown,cityId:number,dateISO:string,locationName:string,
  fetchTime:string):MirrorTriplet{
  if(!validId(cityId))throw new Error('Invalid district ID');
  assertISODate(dateISO);
  const data=object(envelope(raw));
  if(data.ilce!==cityId||data.kaynak!=='Diyanet İşleri Başkanlığı')
    throw new Error('Mirror provider identity mismatch');
  const rows=data.gunler;
  if(!Array.isArray(rows)||rows.length>45||rows.length<2)
    throw new Error('Missing mirror dates');
  const byDate=new Map<string,MirrorPrayerDay>();
  const label=name(locationName);
  for(const row of rows){
    const day=parseDay(row,cityId,label,fetchTime);
    if(byDate.has(day.dateISO))throw new Error('Duplicate date');
    byDate.set(day.dateISO,day);
  }
  const today=byDate.get(dateISO);
  const next=byDate.get(shiftedDate(dateISO,1));
  if(!today||!next)throw new Error('Missing today or next day from mirror provider');
  // The documented public API starts at *today*. Yesterday's record will
  // normally be absent, which must not invalidate every legitimate prayer time.
  const previous=byDate.get(shiftedDate(dateISO,-1))??null;
  const upcoming:MirrorPrayerDay[]=[];
  // Provider can return 15 days or more; only store consecutive published days.
  for(let i=0;i<16;i++){
    const published=byDate.get(shiftedDate(dateISO,i));
    if(!published)break;
    upcoming.push(published);
  }
  return {source:MIRROR_SOURCE,dateISO,city:{id:cityId,name:label,state_id:0},
    previous,today,next,upcoming};
}
export function validateCachedMirrorTriplet(value:unknown,cityId:number,dateISO:string,now=Date.now()):MirrorTriplet{
  const t=object(value);
  if(t.source!==MIRROR_SOURCE||t.dateISO!==assertISODate(dateISO))throw new Error('Cached source mismatch');
  const city=object(t.city);
  if(city.id!==cityId||typeof city.name!=='string')throw new Error('Cached district mismatch');
  for(const [key,offset] of ([['previous',-1],['today',0],['next',1]] as const)){
    const day=t[key];
    if(key==='previous' && day===null)continue;
    const d=object(day);
    if(d.source!==MIRROR_SOURCE||d.cityId!==cityId||d.isDemo!==false||
       d.dateISO!==shiftedDate(dateISO,offset)||d.timezone!=='Europe/Istanbul'||
       typeof d.fetchedAt!=='string')throw new Error('Cached day mismatch');
    const age=now-Date.parse(d.fetchedAt);
    if(!Number.isFinite(age)||age<0||age>MIRROR_CACHE_MS)
      throw new Error('Mirror cache expired (55 minutes)');
    if(!Array.isArray(d.times)||d.times.length!==6)throw new Error('Invalid cached clock list');
    let last=-1;
    d.times.forEach((time,i)=>{
      const x=object(time);
      if(x.key!==PRAYER_KEYS[i]||typeof x.time!=='string')throw new Error('Invalid cached fields');
      const minutes=timeToMinutes(x.time);
      if(minutes<=last)throw new Error('Invalid cached time order');
      last=minutes;
    });
  }
  const future=t.upcoming;
  if(!Array.isArray(future)||future.length<2||future.length>16)
    throw new Error('Cached provider calendar incomplete');
  for(let i=0;i<future.length;i++){
    const entry=object(future[i]);
    if(entry.dateISO!==shiftedDate(dateISO,i)||entry.cityId!==cityId||
       entry.source!==MIRROR_SOURCE||entry.isDemo!==false||
       entry.timezone!=='Europe/Istanbul'||!Array.isArray(entry.times)||
       entry.times.length!==6||typeof entry.fetchedAt!=='string')
      throw new Error('Cached future date invalid');
    const age=now-Date.parse(entry.fetchedAt);
    if(!Number.isFinite(age)||age<0||age>MIRROR_CACHE_MS)
      throw new Error('Cached future source expired');
    let last=-1;
    (entry.times as unknown[]).forEach((row,index)=>{
      const x=object(row);
      if(x.key!==PRAYER_KEYS[index]||typeof x.time!=='string')
        throw new Error('Cached future time invalid');
      const minute=timeToMinutes(x.time);
      if(minute<=last)throw new Error('Cached future clock not ordered');
      last=minute;
    });
  }
  return t as MirrorTriplet;
}


/**
 * Accurate countdowns from the public provider's *published* clock values.
 * This API usually supplies today+tomorrow, NOT yesterday.
 * Never synthesize yesterday's Isha or copy today's Isha into yesterday.
 */
export function calculateMirrorPhase(
  yesterday:MirrorPrayerDay|null,today:MirrorPrayerDay,tomorrow:MirrorPrayerDay,
  secondsOfDay:number,
):PrayerPhase{
  if(today.source!==MIRROR_SOURCE||tomorrow.source!==MIRROR_SOURCE||
    today.isDemo||tomorrow.isDemo||today.timezone!=='Europe/Istanbul'||
    tomorrow.timezone!==today.timezone||
    tomorrow.dateISO!==shiftedDate(today.dateISO,1)) {
    throw new Error('Invalid consecutive mirror days');
  }
  if(!Number.isFinite(secondsOfDay)||secondsOfDay<0||secondsOfDay>=86400)
    throw new RangeError('Invalid local time');
  if(yesterday)return calculateVerifiedPhase(yesterday,today,tomorrow,secondsOfDay);

  const fajr=timeToMinutes(today.times[0].time)*60;
  const isha=timeToMinutes(today.times[5].time)*60;
  if(secondsOfDay>=fajr&&secondsOfDay<isha)
    return calculatePrayerPhase(today,secondsOfDay);

  const beforeFajr=secondsOfDay<fajr;
  const next=beforeFajr?today.times[0]:tomorrow.times[0];
  const current=beforeFajr?today.times[5]:today.times[5];
  const nextBoundary=beforeFajr
    ?fajr:86400+timeToMinutes(tomorrow.times[0].time)*60;
  const previousBoundary=beforeFajr?0:isha;
  const secondsRemaining=nextBoundary-secondsOfDay;
  // Before Fajr the real last Isha is unavailable. A midnight-to-Fajr
  // progress bar would claim to be a complete prayer interval, so suppress it.
  const progress=beforeFajr?0:Math.max(0,Math.min(1,
    (secondsOfDay-isha)/(nextBoundary-isha)));
  const urgency:Urgency=secondsRemaining<=900?'imminent':
    secondsRemaining<=2700?'approaching':'normal';
  return {current,next,previousBoundary,nextBoundary,secondsRemaining,progress,urgency};
}
