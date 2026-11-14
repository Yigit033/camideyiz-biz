import {PRAYER_KEYS, timeToMinutes, type PrayerSchedule, type PrayerTime} from './prayer.ts';

export type VerifiedPrayerDay = PrayerSchedule & {
  source: 'diyanet-awqat-salah';
  cityId: number;
  hijriDate: string | null;
  fetchedAt: string;
};
export type PublicPlace = {id:number;name:string;stateId?:number};

const labels = ['İmsak','Güneş','Öğle','İkindi','Akşam','Yatsı'];
const sourceKeys = ['fajr','sunrise','dhuhr','asr','maghrib','isha'] as const;
function record(value: unknown): Record<string,unknown> {
  if (!value || typeof value!=='object' || Array.isArray(value)) throw new Error('Invalid Diyanet payload');
  return value as Record<string,unknown>;
}
function hhmm(value:unknown):string {
  if(typeof value!=='string' || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)) {
    throw new Error('Invalid prayer time in provider response');
  }
  return value.slice(0,5);
}
function dateFromRow(row:Record<string,unknown>):string {
  const iso=row.gregorianDateLongIso8601;
  if(typeof iso==='string' && /^\d{4}-\d{2}-\d{2}T/.test(iso)) {
    return assertISODate(iso.slice(0,10));
  }
  const short=row.gregorianDateShort;
  if(typeof short==='string' && /^\d{2}\.\d{2}\.\d{4}$/.test(short)) {
    const [d,m,y]=short.split('.');
    return assertISODate(y+'-'+m+'-'+d);
  }
  throw new Error('Missing Gregorian date in provider response');
}
export function assertISODate(date:string):string {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Expected YYYY-MM-DD');
  const value=new Date(date+'T12:00:00Z');
  if(!Number.isFinite(value.getTime())||value.toISOString().slice(0,10)!==date) {
    throw new Error('Invalid calendar date');
  }
  return date;
}
export function parseDiyanetDay(
  raw:unknown, cityId:number,locationName:string,fetchedAt:string,
):VerifiedPrayerDay {
  if(!Number.isInteger(cityId)||cityId<=0)throw new Error('Invalid Diyanet city ID');
  const row=record(raw);
  if(row.greenwichMeanTimeZone!==undefined &&
    Number(row.greenwichMeanTimeZone)!==3)throw new Error('Unexpected timezone for Turkey');
  const times:PrayerTime[]=sourceKeys.map((key,i)=>({
    key:PRAYER_KEYS[i],label:labels[i],time:hhmm(row[key]),
  }));
  if(times.some((item,i)=>i>0&&timeToMinutes(item.time)<=timeToMinutes(times[i-1].time))) {
    throw new Error('Prayer boundaries are not strictly increasing');
  }
  const hijri=typeof row.hijriDateLong==='string' && row.hijriDateLong.length<=100
    ? row.hijriDateLong : null;
  if(!locationName.trim()||locationName.length>140)throw new Error('Invalid city name');
  const stamp=new Date(fetchedAt);
  if(!Number.isFinite(stamp.getTime()))throw new Error('Invalid fetch timestamp');
  return {
    cityId,locationName:locationName.trim(),timezone:'Europe/Istanbul',source:'diyanet-awqat-salah',
    dateISO:dateFromRow(row),isDemo:false,times,hijriDate:hijri,fetchedAt:stamp.toISOString(),
  };
}
export function parseDiyanetList(raw:unknown):Array<Record<string,unknown>> {
  const wrapper=record(raw);
  if(wrapper.success!==true||!Array.isArray(wrapper.data))throw new Error('Diyanet response was not successful');
  return wrapper.data.map(record);
}
export function parsePlace(raw:unknown,stateId?:number):PublicPlace {
  const r=record(raw);
  const id=Number(r.id);
  if(!Number.isSafeInteger(id)||id<=0||id>99999999||typeof r.name!=='string'||!r.name.trim()||
    r.name.length>140)throw new Error('Invalid place data');
  return {id,name:r.name.trim(),...(stateId===undefined?{}:{stateId})};
}
