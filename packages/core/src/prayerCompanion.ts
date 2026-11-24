import {
  PRAYER_KEYS, timeToMinutes, zonedClock,
  type PrayerKey, type PrayerSchedule,
} from './prayer.ts';
import {assertISODate} from './diyanet.ts';
import {getKerahatView,type KerahatSettings} from './kerahat.ts';

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
 * notification. The single source of truth for both schedulers.
 *
 * Only the at-time event ever plays the ezan. An early ("N dakika önce")
 * reminder always stays a notification: the ezan announces that the time
 * HAS entered, so voicing it (or a fragment of it) early would tell everyone
 * in earshot to pray, or break the fast at Akşam, before the time. */
export function playsFullAdhan(event:PrayerAlertEvent,settings:PrayerAlertSettings):boolean{
  return settings.sound==='adhan'&&event.kind==='atTime'&&
    (ADHAN_PRAYERS as readonly string[]).includes(event.prayer)&&
    settings.adhanFor[event.prayer as AdhanPrayer]===true;
}

/** A prayer's ezan toggle as the user sees it: ticked AND its at-time alert
 * is on (the at-time event is what the ezan replaces). A ticked chip whose
 * at-time alert was off used to look on while nothing could ever play. */
export function adhanPrayerOn(settings:PrayerAlertSettings,key:AdhanPrayer):boolean{
  if(key==='imsak'&&!SABAH_EZANI_AVAILABLE)return false;
  const rule=settings.rules[key];
  return settings.adhanFor[key]===true&&rule.enabled&&rule.atTime;
}
/** The prayers that will really be voiced with the ezan (empty unless the
 * ezan sound is chosen). Mirrors playsFullAdhan for at-time events. */
export function voicedAdhanPrayers(settings:PrayerAlertSettings):AdhanPrayer[]{
  if(settings.sound!=='adhan')return [];
  return ADHAN_PRAYERS.filter(key=>adhanPrayerOn(settings,key));
}
/** Turning a prayer's ezan on also turns on the at-time alert it replaces;
 * turning it off keeps that alert as a normal notification. */
export function withAdhanPrayer(settings:PrayerAlertSettings,key:AdhanPrayer,
  on:boolean):PrayerAlertSettings{
  if(key==='imsak'&&!SABAH_EZANI_AVAILABLE)return validateAlertSettings(settings);
  const rules={...settings.rules};
  if(on)rules[key]={...rules[key],enabled:true,atTime:true};
  return validateAlertSettings({...settings,rules,adhanFor:{...settings.adhanFor,[key]:on}});
}
/** Choosing the ezan must always lead to an ezan: if no prayer would be
 * voiced, the default ezan prayers are switched on with their at-time alert. */
export function withAdhanSound(settings:PrayerAlertSettings):PrayerAlertSettings{
  let next=validateAlertSettings({...settings,sound:'adhan'});
  if(voicedAdhanPrayers(next).length>0)return next;
  for(const key of ADHAN_PRAYERS)
    if(DEFAULT_ADHAN_FOR[key])next=withAdhanPrayer(next,key,true);
  return next;
}

/** What can stop the chosen ezan on this phone, most fundamental first.
 * The app shows one actionable row per blocker. */
export type AdhanBlocker=
  'alerts-off'|'notifications'|'no-prayer'|'exact-alarm'|'total-silence'|
  'silent-mode'|'alarm-muted'|'battery'|'background';
export type AdhanDeviceState={
  notifications:'granted'|'denied'|'unknown';
  /** Android 12+ "Alarms & reminders"; null when unknown / not applicable. */
  exactAlarms:boolean|null;
  ringer:'normal'|'vibrate'|'silent'|null;
  /** Do Not Disturb state; null when unknown. */
  interruption:'all'|'priority'|'alarms'|'none'|null;
  alarmVolume:number|null;
  batteryUnrestricted:boolean|null;
  /** The OEM is known to stop background apps (ColorOS…) or an ezan alarm
   * was already lost while the phone was running. */
  backgroundRisk:boolean;
};
export function adhanBlockers(settings:PrayerAlertSettings,
  device:AdhanDeviceState):AdhanBlocker[]{
  if(settings.sound!=='adhan')return [];
  const result:AdhanBlocker[]=[];
  if(!settings.enabled)result.push('alerts-off');
  else if(device.notifications==='denied')result.push('notifications');
  if(voicedAdhanPrayers(settings).length===0)result.push('no-prayer');
  if(device.exactAlarms===false)result.push('exact-alarm');
  if(device.interruption==='none')result.push('total-silence');
  else if(!settings.adhanInSilent&&(
    (device.ringer!==null&&device.ringer!=='normal')||
    device.interruption==='priority'||device.interruption==='alarms'))
    result.push('silent-mode');
  if(device.alarmVolume===0)result.push('alarm-muted');
  if(device.batteryUnrestricted===false)result.push('battery');
  if(device.backgroundRisk)result.push('background');
  return result;
}
function plusDays(dateISO:string,days:number):string{
  const base=Date.parse(assertISODate(dateISO)+'T12:00:00Z');
  if(!Number.isInteger(days)||!Number.isFinite(base))throw new RangeError('Invalid day offset');
  return new Date(base+days*86400_000).toISOString().slice(0,10);
}

/** Each clock is cross-checked against the IANA zone once per process; the
 * same 16-day calendar is otherwise re-verified thousands of times while the
 * widget, alert and home plans are built. Only verified instants are kept. */
const VERIFIED_INSTANTS=new Map<string,number>();
const VERIFIED_INSTANT_LIMIT=2048;
/** Türkiye has used permanent UTC+03:00 since 2016.
 * Every result is cross-validated against the IANA timezone so a future
 * regulatory timezone change FAILS CLOSED instead of silently misfiring.
 */
export function prayerInstant(dateISO:string,hhmm:string):number{
  const key=dateISO+' '+hhmm;
  const known=VERIFIED_INSTANTS.get(key);
  if(known!==undefined)return known;
  assertISODate(dateISO);
  const minutes=timeToMinutes(hhmm);
  const at=Date.parse(dateISO+'T'+hhmm+':00+03:00');
  if(!Number.isFinite(at))throw new RangeError('Invalid instant');
  const local=zonedClock(new Date(at),PRAYER_TIMEZONE);
  if(local.dateISO!==dateISO || Math.floor(local.secondsOfDay/60)!==minutes)
    throw new RangeError('Prayer time zone rule changed; refresh scheduler');
  if(VERIFIED_INSTANTS.size>=VERIFIED_INSTANT_LIMIT)VERIFIED_INSTANTS.clear();
  VERIFIED_INSTANTS.set(key,at);
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
  /** Inside a kerahet window, by the same rule as the home screen. */
  kerahat:boolean;
  /** Published Hijri date of the current day, '' when the source has none. */
  hijriDate:string;
};
/** Published prayers of a calendar, computed once and reused for every
 * snapshot of a timeline (previously each of ~160 snapshots re-verified all
 * ~96 clocks of the calendar on the JS thread). */
type WidgetPlan={
  days:readonly PrayerSchedule[];
  /** First published six-prayer day for each date, as days.find() picked it. */
  current:ReadonlyMap<string,PrayerSchedule>;
  /** Every published prayer instant, ascending (stable for equal instants). */
  upcoming:readonly {instant:number;name:string;time:string}[];
  kerahat?:KerahatSettings;
};
function widgetPlan(days:readonly PrayerSchedule[],kerahat?:KerahatSettings):WidgetPlan{
  const current=new Map<string,PrayerSchedule>();
  const upcoming:{instant:number;name:string;time:string}[]=[];
  // Only non-demo published days, never a local astronomical approximation.
  for(const day of days){
    if(day.isDemo||day.timezone!==PRAYER_TIMEZONE)continue;
    if(day.times.length===6&&!current.has(day.dateISO))current.set(day.dateISO,day);
    for(const item of day.times)
      upcoming.push({instant:prayerInstant(day.dateISO,item.time),name:item.label,time:item.time});
  }
  upcoming.sort((a,b)=>a.instant-b.instant);
  return {days,current,upcoming,kerahat};
}
function widgetSnapshot(plan:WidgetPlan,nowMs:number):PrayerWidgetSnapshot{
  const clock=zonedClock(new Date(nowMs),PRAYER_TIMEZONE);
  const fallback:PrayerWidgetSnapshot={
    status:'no-data',city:'Konum seçilmedi',dateISO:clock.dateISO,
    nextName:'Takvimi aç',nextTime:'',nextAt:0,remainingMinutes:0,
    updatedAt:nowMs,times:[],kerahat:false,hijriDate:'',
  };
  if(!plan.days.length)return fallback;
  const current=plan.current.get(clock.dateISO);
  // First published prayer strictly after now (binary search).
  let low=0,high=plan.upcoming.length;
  while(low<high){
    const mid=(low+high)>>>1;
    if(plan.upcoming[mid].instant>nowMs)high=mid;else low=mid+1;
  }
  const next=plan.upcoming[low];
  if(!current||!next)return {...fallback,city:current?.locationName??plan.days[0]?.locationName??fallback.city};
  return {
    status:'ready',city:current.locationName,dateISO:clock.dateISO,
    nextName:next.name,nextTime:next.time,nextAt:next.instant,
    remainingMinutes:Math.ceil((next.instant-nowMs)/60_000),
    updatedAt:nowMs,
    times:current.times.map(t=>({...t})),
    kerahat:plan.kerahat!==undefined&&
      getKerahatView(current,clock.dateISO,clock.secondsOfDay,plan.kerahat).active!==null,
    hijriDate:typeof current.hijriDate==='string'?current.hijriDate.trim():'',
  };
}
export function buildPrayerWidgetSnapshot(
  days:readonly PrayerSchedule[], nowMs:number,
  kerahat?:KerahatSettings,
):PrayerWidgetSnapshot{
  return widgetSnapshot(widgetPlan(days,kerahat),nowMs);
}
/** iOS WidgetKit precomputed boundary updates. Countdown text is system-driven,
 * rather than scheduling a widget refresh every minute. Android snapshots only
 * update on app wake, and must not label a static number "live".
 * With kerahet settings, each kerahet window start/end is a boundary too, so
 * a widget enters and leaves the kerahet look on time without waking the app.
 */
export function buildPrayerWidgetTimeline(
  days:readonly PrayerSchedule[], nowMs:number,
  limit=60,kerahat?:KerahatSettings,
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
    if(kerahat===undefined)continue;
    for(const window of getKerahatView(day,day.dateISO,0,kerahat).windows){
      for(const seconds of [window.startSeconds,window.endSeconds]){
        const point=prayerInstant(day.dateISO,'00:00')+seconds*1000;
        if(point>nowMs)events.add(point);
      }
    }
  }
  const plan=widgetPlan(days,kerahat);
  return [...events].sort((a,b)=>a-b).slice(0,limit).map(date=>({
    date,snapshot:widgetSnapshot(plan,date),
  }));
}
