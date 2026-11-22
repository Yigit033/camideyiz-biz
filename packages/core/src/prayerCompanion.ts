import {
  PRAYER_KEYS, timeToMinutes, zonedClock,
  type PrayerKey, type PrayerSchedule,
} from './prayer.ts';
import {assertISODate} from './diyanet.ts';

export const PRAYER_TIMEZONE='Europe/Istanbul' as const;
export const ALERT_MAX_EVENTS=60; // iOS only retains up to 64 pending local notifications.
export const ALERT_MAX_DAYS=7;
// Android has no 64-request ceiling: a longer verified horizon keeps alerts
// (and ezan) on time even if the app is not opened for over a week.
export const ANDROID_ALERT_MAX_EVENTS=120;
export const ANDROID_ALERT_MAX_DAYS=10;
export const ALERT_LEADS=[0,5,10,15,30,45,60] as const;
export type AlertLead=typeof ALERT_LEADS[number];
export type AlertSound='default'|'silent'|'adhan';
export type PrayerAlertRule={
  enabled:boolean;
  atTime:boolean;
  minutesBefore:AlertLead; // 0 disables the earlier reminder.
};
/** The five ezan times. Güneş doğuşu is never an ezan. */
export const ADHAN_PRAYERS=['imsak','ogle','ikindi','aksam','yatsi'] as const;
export type AdhanPrayer=typeof ADHAN_PRAYERS[number];
/** The bundled recording is an öğle ezanı (Uşşak). The sabah ezanı adds
 * "es-salâtü hayrun mine'n-nevm", so playing this recording at İmsak would be
 * religiously wrong. İmsak stays a notification until a dedicated, licensed
 * sabah ezanı recording is bundled and this flag is flipped. */
export const SABAH_EZANI_AVAILABLE=false;
export type PrayerAlertSettings={
  enabled:boolean;
  sound:AlertSound;
  /** Android: deliver via AlarmManager.setAlarmClock, which OEM battery
   * savers never defer (shows the system alarm icon). */
  precise:boolean;
  /** With sound 'adhan': which prayers play the full ezan instead of a notification. */
  adhanFor:Record<AdhanPrayer,boolean>;
  /** Android: voice the ezan on the alarm stream even when the phone is on
   * silent/vibrate or Do Not Disturb (like an alarm clock). Off by default:
   * a silenced phone gets the "vakti girdi" notification instead. */
  adhanInSilent:boolean;
  rules:Record<PrayerKey,PrayerAlertRule>;
};
const ordinary=():PrayerAlertRule=>({enabled:true,atTime:true,minutesBefore:0});
const DEFAULT_ADHAN_FOR:Readonly<Record<AdhanPrayer,boolean>>={
  imsak:SABAH_EZANI_AVAILABLE,ogle:true,ikindi:true,aksam:true,yatsi:true,
};
export const DEFAULT_ALERT_SETTINGS:Readonly<PrayerAlertSettings>={
  enabled:false,
  sound:'default',
  precise:true,
  adhanFor:{...DEFAULT_ADHAN_FOR},
  adhanInSilent:false,
  rules:{
    imsak:ordinary(),
    gunes:{enabled:false,atTime:true,minutesBefore:0},
    ogle:ordinary(),
    ikindi:ordinary(),
    aksam:ordinary(),
    yatsi:ordinary(),
  },
};

/** Settings saved by older app versions lack `precise`/`adhanFor`; they get
 * the safe defaults instead of being rejected (which would reset the user). */
export function validateAlertSettings(value:unknown):PrayerAlertSettings{
  if(!value||typeof value!=='object'||Array.isArray(value))
    throw new RangeError('Invalid notification settings');
  const input=value as Partial<PrayerAlertSettings>;
  if(typeof input.enabled!=='boolean'||(input.sound!=='default'&&input.sound!=='silent'&&input.sound!=='adhan')||
     !input.rules||typeof input.rules!=='object')
    throw new RangeError('Invalid global notification settings');
  if(input.precise!==undefined&&typeof input.precise!=='boolean')
    throw new RangeError('Invalid delivery precision');
  if(input.adhanInSilent!==undefined&&typeof input.adhanInSilent!=='boolean')
    throw new RangeError('Invalid silent-mode ezan preference');
  const rules={} as Record<PrayerKey,PrayerAlertRule>;
  for(const key of PRAYER_KEYS){
    const rule=input.rules[key];
    if(!rule||typeof rule.enabled!=='boolean'||typeof rule.atTime!=='boolean'||
       !ALERT_LEADS.includes(rule.minutesBefore))
      throw new RangeError('Invalid prayer preference: '+key);
    rules[key]={enabled:rule.enabled,atTime:rule.atTime,minutesBefore:rule.minutesBefore};
  }
  const adhanFor={...DEFAULT_ADHAN_FOR};
  if(input.adhanFor!==undefined){
    if(!input.adhanFor||typeof input.adhanFor!=='object'||Array.isArray(input.adhanFor))
      throw new RangeError('Invalid ezan prayer selection');
    for(const key of ADHAN_PRAYERS){
      const chosen=input.adhanFor[key];
      if(chosen===undefined)continue;
      if(typeof chosen!=='boolean')throw new RangeError('Invalid ezan selection: '+key);
      adhanFor[key]=chosen;
    }
  }
  if(!SABAH_EZANI_AVAILABLE)adhanFor.imsak=false;
  return {enabled:input.enabled,sound:input.sound,precise:input.precise??true,adhanFor,
    adhanInSilent:input.adhanInSilent??false,rules};
}

/** True when this event is voiced by the native full ezan INSTEAD of a
 * notification. The single source of truth for both schedulers. */
export function playsFullAdhan(event:PrayerAlertEvent,settings:PrayerAlertSettings):boolean{
  return settings.sound==='adhan'&&event.kind==='atTime'&&
    (ADHAN_PRAYERS as readonly string[]).includes(event.prayer)&&
    settings.adhanFor[event.prayer as AdhanPrayer]===true;
}
function plusDays(dateISO:string,days:number):string{
  const base=Date.parse(assertISODate(dateISO)+'T12:00:00Z');
  if(!Number.isInteger(days)||!Number.isFinite(base))throw new RangeError('Invalid day offset');
  return new Date(base+days*86400_000).toISOString().slice(0,10);
}

/** Türkiye has used permanent UTC+03:00 since 2016.
 * Every result is cross-validated against the IANA timezone so a future
 * regulatory timezone change FAILS CLOSED instead of silently misfiring.
 */
export function prayerInstant(dateISO:string,hhmm:string):number{
  assertISODate(dateISO);
  const minutes=timeToMinutes(hhmm);
  const at=Date.parse(dateISO+'T'+hhmm+':00+03:00');
  if(!Number.isFinite(at))throw new RangeError('Invalid instant');
  const local=zonedClock(new Date(at),PRAYER_TIMEZONE);
  if(local.dateISO!==dateISO || Math.floor(local.secondsOfDay/60)!==minutes)
    throw new RangeError('Prayer time zone rule changed; refresh scheduler');
  return at;
}
export type PrayerAlertEvent={
  key:string;prayer:PrayerKey;label:string;dateISO:string;
  localTime:string;fireAt:number;locationName:string;
  leadMinutes:number;kind:'before'|'atTime';
};
export function createPrayerAlertPlan(
  days:readonly PrayerSchedule[], settings:PrayerAlertSettings, nowMs:number,
  maxEvents=ALERT_MAX_EVENTS, maxDays=ALERT_MAX_DAYS,
):PrayerAlertEvent[]{
  const prefs=validateAlertSettings(settings);
  if(!prefs.enabled)return [];
  if(!Number.isFinite(nowMs)||!Number.isInteger(maxEvents)||maxEvents<1||
     maxEvents>ANDROID_ALERT_MAX_EVENTS||!Number.isInteger(maxDays)||maxDays<1||
     maxDays>ANDROID_ALERT_MAX_DAYS)
    throw new RangeError('Invalid notification planning bounds');
  if(!days.length)return [];
  const currentDate=zonedClock(new Date(nowMs),PRAYER_TIMEZONE).dateISO;
  const latest=plusDays(currentDate,maxDays-1);
  const byDate=new Map<string,PrayerSchedule>();
  for(const day of days){
    if(day.isDemo||day.timezone!==PRAYER_TIMEZONE||day.dateISO<currentDate||
       day.dateISO>latest)continue;
    assertISODate(day.dateISO);
    if(byDate.has(day.dateISO))throw new Error('Duplicate prayer schedule');
    if(day.times.length!==PRAYER_KEYS.length)throw new Error('Incomplete prayer schedule');
    day.times.forEach((x,index)=>{
      if(x.key!==PRAYER_KEYS[index])throw new Error('Prayer order mismatch');
      timeToMinutes(x.time);
      if(index && timeToMinutes(x.time)<=timeToMinutes(day.times[index-1].time))
        throw new Error('Prayer clock not increasing');
    });
    byDate.set(day.dateISO,day);
  }
  if(byDate.size===0)return [];
  // If any intermediate day is absent do not schedule speculative dates beyond it.
  const ordered:PrayerSchedule[]=[];
  for(let index=0;index<maxDays;index++){
    const day=byDate.get(plusDays(currentDate,index));
    if(!day)break;
    ordered.push(day);
  }
  const events:PrayerAlertEvent[]=[];
  for(const day of ordered){
    for(const item of day.times){
      const rule=prefs.rules[item.key];
      if(!rule.enabled)continue;
      const base=prayerInstant(day.dateISO,item.time);
      const offsets=[...(rule.minutesBefore>0?[rule.minutesBefore]:[]),...(rule.atTime?[0]:[])];
      for(const leadMinutes of offsets){
        const at=base-leadMinutes*60_000;
        if(at<=nowMs+5000)continue; // Don't fire missed or immediate alarms.
        const kind=leadMinutes===0?'atTime':'before';
        events.push({
          key:[day.dateISO,item.key,kind,leadMinutes].join(':'),
          prayer:item.key,label:item.label,dateISO:day.dateISO,
          localTime:item.time,fireAt:at,leadMinutes,kind,
          locationName:day.locationName,
        });
      }
    }
  }
  return events.sort((a,b)=>a.fireAt-b.fireAt||a.key.localeCompare(b.key))
    .slice(0,maxEvents);
}

export type PrayerWidgetSnapshot={
  status:'ready'|'no-data';
  city:string;dateISO:string;
  nextName:string;nextTime:string;nextAt:number;
  remainingMinutes:number;updatedAt:number;
  times:{key:PrayerKey;label:string;time:string}[];
};
export function buildPrayerWidgetSnapshot(
  days:readonly PrayerSchedule[], nowMs:number,
):PrayerWidgetSnapshot{
  const clock=zonedClock(new Date(nowMs),PRAYER_TIMEZONE);
  const fallback:PrayerWidgetSnapshot={
    status:'no-data',city:'Konum seçilmedi',dateISO:clock.dateISO,
    nextName:'Takvimi aç',nextTime:'',nextAt:0,remainingMinutes:0,
    updatedAt:nowMs,times:[],
  };
  if(!days.length)return fallback;
  // Only non-demo published days, never a local astronomical approximation.
  const current=days.find(d=>d.dateISO===clock.dateISO&&!d.isDemo&&
    d.timezone===PRAYER_TIMEZONE&&d.times.length===6);
  const upcoming: {instant:number;name:string;time:string}[]=[];
  for(const day of days){
    if(day.isDemo||day.timezone!==PRAYER_TIMEZONE)continue;
    for(const item of day.times){
      const at=prayerInstant(day.dateISO,item.time);
      if(at>nowMs)upcoming.push({instant:at,name:item.label,time:item.time});
    }
  }
  upcoming.sort((a,b)=>a.instant-b.instant);
  const next=upcoming[0];
  if(!current||!next)return {...fallback,city:current?.locationName??days[0]?.locationName??fallback.city};
  return {
    status:'ready',city:current.locationName,dateISO:clock.dateISO,
    nextName:next.name,nextTime:next.time,nextAt:next.instant,
    remainingMinutes:Math.ceil((next.instant-nowMs)/60_000),
    updatedAt:nowMs,
    times:current.times.map(t=>({...t})),
  };
}
/** iOS WidgetKit precomputed boundary updates. Countdown text is system-driven,
 * rather than scheduling a widget refresh every minute. Android snapshots only
 * update on app wake, and must not label a static number "live".
 */
export function buildPrayerWidgetTimeline(
  days:readonly PrayerSchedule[], nowMs:number,
  limit=60,
):{date:number;snapshot:PrayerWidgetSnapshot}[]{
  const events=new Set<number>([nowMs]);
  for(const day of days){
    if(day.isDemo||day.timezone!==PRAYER_TIMEZONE)continue;
    const nextDay=prayerInstant(plusDays(day.dateISO,1),'00:00');
    if(nextDay>nowMs)events.add(nextDay);
    for(const item of day.times){
      const point=prayerInstant(day.dateISO,item.time);
      if(point>nowMs)events.add(point);
    }
  }
  return [...events].sort((a,b)=>a-b).slice(0,limit).map(date=>({
    date,snapshot:buildPrayerWidgetSnapshot(days,date),
  }));
}
