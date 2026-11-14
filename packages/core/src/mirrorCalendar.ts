import {PRAYER_KEYS,timeToMinutes,type PrayerSchedule,type PrayerTime} from './prayer.ts';
import {assertISODate} from './diyanet.ts';

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
  previous:MirrorPrayerDay;
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
  if(!Array.isArray(rows)||rows.length>45||rows.length<3)
    throw new Error('Missing mirror dates');
  const byDate=new Map<string,MirrorPrayerDay>();
  const label=name(locationName);
  for(const row of rows){
    const day=parseDay(row,cityId,label,fetchTime);
    if(byDate.has(day.dateISO))throw new Error('Duplicate date');
    byDate.set(day.dateISO,day);
  }
  const pick=(offset:number)=>{
    const day=byDate.get(shiftedDate(dateISO,offset));
    if(!day)throw new Error('Missing adjacent date from mirror provider');
    return day;
  };
  return {source:MIRROR_SOURCE,dateISO,city:{id:cityId,name:label,state_id:0},
    previous:pick(-1),today:pick(0),next:pick(1)};
}
export function validateCachedMirrorTriplet(value:unknown,cityId:number,dateISO:string,now=Date.now()):MirrorTriplet{
  const t=object(value);
  if(t.source!==MIRROR_SOURCE||t.dateISO!==assertISODate(dateISO))throw new Error('Cached source mismatch');
  const city=object(t.city);
  if(city.id!==cityId||typeof city.name!=='string')throw new Error('Cached district mismatch');
  for(const [key,offset] of ([['previous',-1],['today',0],['next',1]] as const)){
    const d=object(t[key]);
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
  return t as MirrorTriplet;
}
