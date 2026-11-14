import {
  type PrayerSchedule,type PrayerTime,PRAYER_KEYS,timeToMinutes,
} from './prayer.ts';
import {type PrayerPhase,calculatePrayerPhase,type Urgency} from './timeline.ts';
import {assertISODate,type VerifiedPrayerDay} from './diyanet.ts';

function shiftedDate(date:string,offset:number):string{
  const valid=assertISODate(date);
  return new Date(Date.parse(valid+'T12:00:00Z')+offset*86400000)
    .toISOString().slice(0,10);
}
export type OfficialTriplet = {
  source:'diyanet-awqat-salah';
  dateISO:string;
  city:{id:number;name:string;state_id:number};
  previous:VerifiedPrayerDay;
  today:VerifiedPrayerDay;
  next:VerifiedPrayerDay;
};
export function validateTriplet(value:unknown,expectedCity:number,expectedDate:string):OfficialTriplet{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid verified schedule');
  const payload=value as OfficialTriplet;
  if(payload.source!=='diyanet-awqat-salah'||payload.dateISO!==assertISODate(expectedDate)||
    payload.city?.id!==expectedCity||!payload.city.name||
    !payload.previous||!payload.today||!payload.next)throw new Error('Official schedule identity mismatch');
  const all=[payload.previous,payload.today,payload.next];
  const expected=[shiftedDate(expectedDate,-1),expectedDate,shiftedDate(expectedDate,1)];
  all.forEach((item,index)=>{
    if(item.dateISO!==expected[index]||item.cityId!==expectedCity||item.isDemo!==false||
      item.source!=='diyanet-awqat-salah'||item.timezone!=='Europe/Istanbul'||
      !Array.isArray(item.times)||item.times.length!==6||
      !Number.isFinite(Date.parse(item.fetchedAt))||
      Date.parse(item.fetchedAt)>Date.now()+300_000||
      Date.now()-Date.parse(item.fetchedAt)>92*86400000) {
      throw new Error('Unverified, stale or wrong-date schedule');
    }
    item.times.forEach((t,i)=>{
      if(t.key!==PRAYER_KEYS[i]||!/^([01]\d|2[0-3]):[0-5]\d$/.test(t.time))throw new Error('Invalid prayer fields');
      if(i&&timeToMinutes(t.time)<=timeToMinutes(item.times[i-1].time))
        throw new Error('Invalid daily prayer ordering');
    });
  });
  return payload;
}
/** Cross-midnight clock math uses previous day's Isha and following day's Imsak.
 * This avoids assuming every day's prayer schedule repeats identically.
 */
export function calculateVerifiedPhase(
  yesterday:PrayerSchedule,today:PrayerSchedule,tomorrow:PrayerSchedule,secondsOfDay:number,
):PrayerPhase{
  if(yesterday.isDemo||today.isDemo||tomorrow.isDemo||
    yesterday.timezone!==today.timezone||tomorrow.timezone!==today.timezone||
    shiftedDate(yesterday.dateISO,1)!==today.dateISO||
    shiftedDate(today.dateISO,1)!==tomorrow.dateISO) {
    throw new Error('Missing consecutive verified prayer dates');
  }
  if(!Number.isFinite(secondsOfDay)||secondsOfDay<0||secondsOfDay>=86400)
    throw new RangeError('Invalid local time');
  const fajr=timeToMinutes(today.times[0].time)*60;
  const isha=timeToMinutes(today.times[5].time)*60;
  if(secondsOfDay>=fajr&&secondsOfDay<isha){
    return calculatePrayerPhase(today,secondsOfDay);
  }
  const current:PrayerTime=secondsOfDay<fajr?yesterday.times[5]:today.times[5];
  const next:PrayerTime=secondsOfDay<fajr?today.times[0]:tomorrow.times[0];
  const previousBoundary=secondsOfDay<fajr
    ?timeToMinutes(yesterday.times[5].time)*60-86400:isha;
  const nextBoundary=secondsOfDay<fajr
    ?fajr:timeToMinutes(tomorrow.times[0].time)*60+86400;
  const remaining=nextBoundary-secondsOfDay;
  const progress=Math.max(0,Math.min(1,(secondsOfDay-previousBoundary)/(nextBoundary-previousBoundary)));
  const urgency:Urgency=remaining<=900?'imminent':remaining<=2700?'approaching':'normal';
  return {current,next,previousBoundary,nextBoundary,secondsRemaining:remaining,progress,urgency};
}
