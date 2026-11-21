import {assertISODate} from './diyanet.ts';
import {PRAYER_KEYS,timeToMinutes,type PrayerSchedule,type PrayerTime} from './prayer.ts';

/** Background widgets never calculate astronomical times. They can only
 * reuse a previously validated published calendar from the selected district.
 * Expired data is rejected and the next request must fetch again. */
/** A published multi-day timetable remains valid until its own dated coverage
 * ends. Network fetch age alone must not wipe still-published offline dates.
 * The 16-day cap matches the maximum retained contiguous calendar horizon. */
export const WIDGET_CACHE_MAX_AGE_MS=16*24*60*60_000;
export const WIDGET_NETWORK_REFRESH_MS=2*60*60_000;
export const WIDGET_CACHE_MAX_DAYS=16;
export type WidgetCalendarCache={
  version:1;cityId:number;cityName:string;fetchedAt:number;
  source:'diyanet-awqat-salah'|'idamedya-diyanet-republished';
  days:PrayerSchedule[];
};

export function makeWidgetCalendarCache(
  cityId:number,cityName:string,
  source:WidgetCalendarCache['source'],
  days:readonly PrayerSchedule[],fetchedAt:number,
):WidgetCalendarCache{
  return {version:1,cityId,cityName,source,fetchedAt,
    days:days.slice(0,WIDGET_CACHE_MAX_DAYS).map(d=>({
      dateISO:d.dateISO,timezone:d.timezone,locationName:d.locationName,
      isDemo:d.isDemo,times:d.times.map(t=>({...t})),
    }))};
}

/** Parse untrusted on-device storage defensively. Reject fake times, wrong
 * cities, stale timestamps, wrong zones, and any non-consecutive date. */
export function parseWidgetCalendarCache(
  input:unknown,nowMs:number,expectedCityId:number,
):WidgetCalendarCache|null{
  if(!input||typeof input!=='object'||Array.isArray(input)||
    !Number.isFinite(nowMs)||!Number.isSafeInteger(expectedCityId)||
    expectedCityId<=0)return null;
  const obj=input as Record<string,unknown>;
  const fetchedAt=obj.fetchedAt;
  if(obj.version!==1||obj.cityId!==expectedCityId||
    typeof obj.cityName!=='string'||!obj.cityName.trim()||
    obj.cityName.length>100||
    (obj.source!=='diyanet-awqat-salah'&&
      obj.source!=='idamedya-diyanet-republished')||
    typeof fetchedAt!=='number'||!Number.isFinite(fetchedAt)||
    fetchedAt>nowMs+60_000||nowMs-fetchedAt>WIDGET_CACHE_MAX_AGE_MS||
    !Array.isArray(obj.days)||obj.days.length<2||
    obj.days.length>WIDGET_CACHE_MAX_DAYS)return null;
  try{
    const days:PrayerSchedule[]=[];
    for(const item of obj.days){
      if(!item||typeof item!=='object'||Array.isArray(item))return null;
      const d=item as Record<string,unknown>;
      const dateISO=assertISODate(d.dateISO as string);
      if(d.isDemo!==false||d.timezone!=='Europe/Istanbul'||
        d.locationName!==obj.cityName||
        !Array.isArray(d.times)||d.times.length!==6)return null;
      const times:PrayerTime[]=[];
      let previous=-1;
      for(let i=0;i<6;i++){
        const entry=d.times[i];
        if(!entry||typeof entry!=='object'||Array.isArray(entry))return null;
        const t=entry as Record<string,unknown>;
        if(t.key!==PRAYER_KEYS[i]||typeof t.label!=='string'||
          !t.label.trim()||t.label.length>25||typeof t.time!=='string')return null;
        const minute=timeToMinutes(t.time);
        if(minute<=previous)return null;
        previous=minute;
        times.push({key:PRAYER_KEYS[i],label:t.label,time:t.time});
      }
      if(days.length){
        const prior=Date.parse(days[days.length-1].dateISO+'T12:00:00Z');
        if(Date.parse(dateISO+'T12:00:00Z')!==prior+86400_000)return null;
      }
      days.push({dateISO,locationName:d.locationName as string,
        timezone:'Europe/Istanbul',isDemo:false,times});
    }
    return {version:1,cityId:expectedCityId,cityName:obj.cityName as string,
      source:obj.source as WidgetCalendarCache['source'],fetchedAt,days};
  }catch{return null;}
}
