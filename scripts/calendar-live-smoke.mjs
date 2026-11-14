/**
 * Optional live integration smoke test. Exercises the same public endpoint and
 * production parser as mobile. No API key, paid provider or mock data.
 *
 * Run: node --experimental-strip-types scripts/calendar-live-smoke.mjs
 */
import {zonedClock} from '../packages/core/src/prayer.ts';
import {parseMirrorTriplet,parseMirrorStates,DEFAULT_MIRROR_PLACE}
  from '../packages/core/src/mirrorCalendar.ts';

const dateISO=zonedClock(new Date(),'Europe/Istanbul').dateISO;
const root='https://idamedya.org/api/v1/namaz';
async function read(path){
  const response=await fetch(root+path,{
    method:'GET',headers:{Accept:'application/json'},
    signal:AbortSignal.timeout(12000),
  });
  if(!response.ok)throw new Error('Source HTTP '+response.status+' for '+path);
  const value=await response.json();
  if(!value||typeof value!=='object')throw new Error('Invalid JSON');
  return value;
}
const [statesRaw,calendarRaw]=await Promise.all([
  read('/iller'),
  read('/'+DEFAULT_MIRROR_PLACE.id),
]);
const states=parseMirrorStates(statesRaw);
if(!states.some(s=>s.id===DEFAULT_MIRROR_PLACE.stateId &&
  s.centerDistrictId===DEFAULT_MIRROR_PLACE.id)){
  throw new Error('Istanbul district mapping has changed');
}
const calendar=parseMirrorTriplet(
  calendarRaw,DEFAULT_MIRROR_PLACE.id,dateISO,DEFAULT_MIRROR_PLACE.name,
  new Date().toISOString(),
);
console.log('LIVE CALENDAR OK',dateISO,calendar.city.name);
for(const t of calendar.today.times)console.log(t.label,t.time);
console.log('Tomorrow Imsak:',calendar.next.times[0].time,
  'Previous day available:',calendar.previous!==null);
