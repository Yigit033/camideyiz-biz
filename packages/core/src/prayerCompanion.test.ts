import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_SCHEDULE,PRAYER_KEYS} from './prayer.ts';
import {DEFAULT_ALERT_SETTINGS,prayerInstant,validateAlertSettings,
  createPrayerAlertPlan,buildPrayerWidgetSnapshot,buildPrayerWidgetTimeline,
  playsFullAdhan,ANDROID_ALERT_MAX_EVENTS,ANDROID_ALERT_MAX_DAYS,
  SABAH_EZANI_AVAILABLE,adhanPrayerOn,voicedAdhanPrayers,withAdhanPrayer,withAdhanSound,
  adhanBlockers} from './prayerCompanion.ts';
const base={...DEMO_SCHEDULE,isDemo:false,dateISO:'2026-11-14',locationName:'İstanbul',
  times:DEMO_SCHEDULE.times.map((x,i)=>({...x,time:
    ['06:15','07:43','12:53','15:30','17:54','19:17'][i]}))};
const next={...base,dateISO:'2026-11-15',times:base.times.map((t,i)=>({...t,time:
  ['06:16','07:44','12:54','15:29','17:53','19:16'][i]}))};
test('Turkey published local prayer clock converted to correct UTC instant',()=>{
 assert.equal(new Date(prayerInstant('2026-11-14','12:53')).toISOString(),'2026-11-14T09:53:00.000Z');
 assert.equal(new Date(prayerInstant('2026-11-15','06:16')).toISOString(),'2026-11-15T03:16:00.000Z');
 assert.throws(()=>prayerInstant('2026-11-14','25:00'));
});
test('notification opt-in disabled by default; invalid controls fail closed',()=>{
 assert.deepEqual(createPrayerAlertPlan([base,next],DEFAULT_ALERT_SETTINGS,
   prayerInstant('2026-11-14','00:00')),[]);
 assert.equal(validateAlertSettings({...DEFAULT_ALERT_SETTINGS,sound:'adhan'}).sound,'adhan');
 assert.equal(DEFAULT_ALERT_SETTINGS.sound,'default',
   'existing users retain their original safe default');
 assert.throws(()=>validateAlertSettings({...DEFAULT_ALERT_SETTINGS,sound:'unknown'}));
 assert.throws(()=>validateAlertSettings({...DEFAULT_ALERT_SETTINGS,
   rules:{...DEFAULT_ALERT_SETTINGS.rules,ogle:{enabled:true,atTime:true,minutesBefore:999}}}));
});
test('full adhan uses identical validated prayer times; sunrise is never an ezan',()=>{
 const config=validateAlertSettings({...DEFAULT_ALERT_SETTINGS,enabled:true,sound:'adhan'});
 const events=createPrayerAlertPlan([base,next],config,prayerInstant('2026-11-14','00:00'));
 assert.ok(events.some(e=>e.prayer==='ogle'&&e.kind==='atTime'));
 assert.ok(events.every(e=>e.prayer!=='gunes'));
 assert.ok(events.every(e=>e.kind==='atTime'||e.kind==='before'));
});
test('one exact reminder and one early reminder on each chosen prayer',()=>{
 const config=validateAlertSettings({...DEFAULT_ALERT_SETTINGS,enabled:true,rules:{
   ...DEFAULT_ALERT_SETTINGS.rules,
   ogle:{enabled:true,atTime:true,minutesBefore:10},
 }});
 const events=createPrayerAlertPlan([base,next],config,prayerInstant('2026-11-14','12:30'));
 const at=events.find(e=>e.key==='2026-11-14:ogle:atTime:0');
 const prior=events.find(e=>e.key==='2026-11-14:ogle:before:10');
 assert.equal(at?.fireAt,prayerInstant('2026-11-14','12:53'));
 assert.equal(prior?.fireAt,prayerInstant('2026-11-14','12:43'));
 assert.ok(!events.some(e=>e.prayer==='gunes'));
 assert.equal(new Set(events.map(e=>e.key)).size,events.length);
});
test('7 day horizon and 60 event OS cap are enforced',()=>{
 const days=Array.from({length:10},(_,i)=>({
   ...base,dateISO:new Date(Date.UTC(2026,10,14+i)).toISOString().slice(0,10),
 }));
 const rules=Object.fromEntries(PRAYER_KEYS.map(k=>[k,{enabled:true,atTime:true,minutesBefore:15}]));
 const config=validateAlertSettings({...DEFAULT_ALERT_SETTINGS,enabled:true,rules});
 const plan=createPrayerAlertPlan(days,config,prayerInstant('2026-11-14','00:00'));
 assert.equal(plan.length,60);
 assert.equal(plan[0].dateISO,'2026-11-14');
 assert.ok(plan.every(p=>p.dateISO<='2026-11-20'));
});
test('settings saved by older versions load with precise delivery and safe ezan defaults',()=>{
 const legacy={enabled:true,sound:'adhan',rules:DEFAULT_ALERT_SETTINGS.rules};
 const loaded=validateAlertSettings(legacy);
 assert.equal(loaded.precise,true);
 assert.deepEqual(loaded.adhanFor,{imsak:SABAH_EZANI_AVAILABLE,ogle:true,ikindi:true,aksam:true,yatsi:true});
 assert.equal(validateAlertSettings({...legacy,precise:false}).precise,false);
 assert.throws(()=>validateAlertSettings({...legacy,precise:'yes'}));
 assert.throws(()=>validateAlertSettings({...legacy,adhanFor:{ogle:1}}));
 // A silenced phone keeps the notification unless the user opts in.
 assert.equal(loaded.adhanInSilent,false);
 assert.equal(validateAlertSettings({...legacy,adhanInSilent:true}).adhanInSilent,true);
 assert.throws(()=>validateAlertSettings({...legacy,adhanInSilent:'yes'}));
});
test('öğle recording never plays at İmsak while no sabah ezanı is bundled',()=>{
 const config=validateAlertSettings({...DEFAULT_ALERT_SETTINGS,enabled:true,sound:'adhan',
   adhanFor:{imsak:true,ogle:true,ikindi:false,aksam:true,yatsi:true}});
 assert.equal(config.adhanFor.imsak,SABAH_EZANI_AVAILABLE);
 const events=createPrayerAlertPlan([base,next],config,prayerInstant('2026-11-14','00:00'));
 const voiced=events.filter(e=>playsFullAdhan(e,config)).map(e=>e.prayer);
 if(!SABAH_EZANI_AVAILABLE)assert.ok(!voiced.includes('imsak'));
 assert.ok(voiced.includes('ogle')&&voiced.includes('aksam'));
 assert.ok(!voiced.includes('ikindi'),'user de-selected ikindi ezanı');
 assert.ok(!voiced.includes('gunes'));
});
test('full ezan only replaces the at-time alert, never early reminders or other sounds',()=>{
 const config=validateAlertSettings({...DEFAULT_ALERT_SETTINGS,enabled:true,sound:'adhan',rules:{
   ...DEFAULT_ALERT_SETTINGS.rules,ogle:{enabled:true,atTime:true,minutesBefore:10}}});
 const events=createPrayerAlertPlan([base,next],config,prayerInstant('2026-11-14','12:00'));
 const early=events.find(e=>e.key==='2026-11-14:ogle:before:10')!;
 const atTime=events.find(e=>e.key==='2026-11-14:ogle:atTime:0')!;
 assert.equal(playsFullAdhan(early,config),false);
 assert.equal(playsFullAdhan(atTime,config),true);
 assert.equal(playsFullAdhan(atTime,{...config,sound:'default'}),false);
});
test('a ticked ezan chip always means an ezan: it needs (and turns on) the at-time alert',()=>{
 // A prayer ticked for the ezan whose at-time alert was off used to look on
 // while nothing could ever play at that prayer.
 const config=validateAlertSettings({...DEFAULT_ALERT_SETTINGS,enabled:true,sound:'adhan',rules:{
   ...DEFAULT_ALERT_SETTINGS.rules,ikindi:{enabled:true,atTime:false,minutesBefore:15},
   yatsi:{enabled:false,atTime:true,minutesBefore:0}}});
 assert.equal(config.adhanFor.ikindi,true);
 assert.equal(adhanPrayerOn(config,'ikindi'),false);
 assert.equal(adhanPrayerOn(config,'yatsi'),false);
 assert.deepEqual(voicedAdhanPrayers(config),['ogle','aksam']);
 const events=createPrayerAlertPlan([base,next],config,prayerInstant('2026-11-14','00:00'));
 const voiced=new Set(events.filter(e=>playsFullAdhan(e,config)).map(e=>e.prayer));
 assert.deepEqual([...voiced].sort(),[...voicedAdhanPrayers(config)].sort(),
   'what the chips show is exactly what the scheduler voices');
 const on=withAdhanPrayer(config,'ikindi',true);
 assert.deepEqual(on.rules.ikindi,{enabled:true,atTime:true,minutesBefore:15},
   'the early reminder choice is kept');
 assert.equal(adhanPrayerOn(on,'ikindi'),true);
 const off=withAdhanPrayer(on,'ogle',false);
 assert.equal(adhanPrayerOn(off,'ogle'),false);
 assert.equal(off.rules.ogle.atTime,true,'turning the ezan off keeps the notification');
 // İmsak stays locked while no sabah ezanı is bundled, and its rule is untouched.
 const imsak=withAdhanPrayer(config,'imsak',true);
 assert.equal(adhanPrayerOn(imsak,'imsak'),SABAH_EZANI_AVAILABLE);
 if(!SABAH_EZANI_AVAILABLE)assert.deepEqual(imsak.rules.imsak,config.rules.imsak);
 assert.deepEqual(voicedAdhanPrayers({...config,sound:'default'}),[]);
});
test('choosing the ezan always leads to an ezan',()=>{
 const none=validateAlertSettings({...DEFAULT_ALERT_SETTINGS,enabled:true,
   adhanFor:{imsak:false,ogle:false,ikindi:false,aksam:false,yatsi:false}});
 const chosen=withAdhanSound(none);
 assert.equal(chosen.sound,'adhan');
 assert.deepEqual(voicedAdhanPrayers(chosen),['ogle','ikindi','aksam','yatsi']);
 // A user's own selection is kept as is.
 const mine=withAdhanSound(withAdhanPrayer(none,'aksam',true));
 assert.deepEqual(voicedAdhanPrayers(mine),['aksam']);
 assert.equal(withAdhanSound({...none,enabled:false}).enabled,false,
   'reminders need the OS notification permission: the app turns them on, not core');
});
test('ezan blockers: one actionable reason each, most fundamental first',()=>{
 const ready={notifications:'granted',exactAlarms:true,ringer:'normal',interruption:'all',
   alarmVolume:5,batteryUnrestricted:true,backgroundRisk:false} as const;
 const adhan=withAdhanSound(validateAlertSettings({...DEFAULT_ALERT_SETTINGS,enabled:true}));
 assert.deepEqual(adhanBlockers(adhan,ready),[]);
 assert.deepEqual(adhanBlockers({...adhan,sound:'default'},{...ready,exactAlarms:false}),[],
   'no ezan chosen, nothing to fix');
 assert.deepEqual(adhanBlockers({...adhan,enabled:false},ready),['alerts-off'],
   'the ezan was chosen while reminders were off: the most common "nothing happens"');
 assert.deepEqual(adhanBlockers(adhan,{...ready,notifications:'denied'}),['notifications']);
 assert.deepEqual(adhanBlockers(adhan,{...ready,exactAlarms:false}),['exact-alarm']);
 assert.deepEqual(adhanBlockers(adhan,{...ready,ringer:'vibrate'}),['silent-mode']);
 assert.deepEqual(adhanBlockers({...adhan,adhanInSilent:true},{...ready,ringer:'vibrate'}),[],
   'opted in: plays on vibrate like an alarm clock');
 assert.deepEqual(adhanBlockers(adhan,{...ready,interruption:'priority'}),['silent-mode']);
 assert.deepEqual(adhanBlockers({...adhan,adhanInSilent:true},{...ready,interruption:'none'}),
   ['total-silence'],'total silence mutes alarms even with the opt-in');
 assert.deepEqual(adhanBlockers(adhan,{...ready,alarmVolume:0}),['alarm-muted']);
 assert.deepEqual(adhanBlockers(adhan,{...ready,batteryUnrestricted:false,backgroundRisk:true}),
   ['battery','background']);
 assert.deepEqual(adhanBlockers(adhan,{...ready,exactAlarms:null,ringer:null,interruption:null,
   alarmVolume:null,batteryUnrestricted:null}),[],'unknown is not a blocker');
 const nothing=validateAlertSettings({...adhan,
   adhanFor:{imsak:false,ogle:false,ikindi:false,aksam:false,yatsi:false}});
 assert.deepEqual(adhanBlockers(nothing,ready),['no-prayer']);
});
test('Android horizon keeps ten verified days within its larger cap',()=>{
 const days=Array.from({length:16},(_,i)=>({
   ...base,dateISO:new Date(Date.UTC(2026,10,14+i)).toISOString().slice(0,10),
 }));
 const config=validateAlertSettings({...DEFAULT_ALERT_SETTINGS,enabled:true});
 const plan=createPrayerAlertPlan(days,config,prayerInstant('2026-11-14','00:00'),
   ANDROID_ALERT_MAX_EVENTS,ANDROID_ALERT_MAX_DAYS);
 assert.equal(plan.length,50,'5 prayers × 10 days');
 assert.equal(plan.at(-1)?.dateISO,'2026-11-23');
 assert.throws(()=>createPrayerAlertPlan(days,config,0,ANDROID_ALERT_MAX_EVENTS+1));
 assert.throws(()=>createPrayerAlertPlan(days,config,0,60,ANDROID_ALERT_MAX_DAYS+1));
});
test('missing intermediate day truncates plan instead of scheduling gaps',()=>{
 const config=validateAlertSettings({...DEFAULT_ALERT_SETTINGS,enabled:true});
 const future={...next,dateISO:'2026-11-17'};
 const plan=createPrayerAlertPlan([base,future],config,prayerInstant('2026-11-14','00:00'));
 assert.ok(plan.every(x=>x.dateISO==='2026-11-14'));
});
test('widget uses published times, crosses evening to following published Imsak',()=>{
 const at=prayerInstant('2026-11-14','20:00');
 const nextAt=buildPrayerWidgetSnapshot([base,next],at);
 assert.equal(nextAt.nextName,'İmsak');
 assert.equal(nextAt.nextTime,'06:16');
 assert.equal(nextAt.remainingMinutes,616);
 assert.equal(nextAt.times.length,6);
});
test('widget returns honest no-data state rather than hardcoded sample times',()=>{
 const snapshot=buildPrayerWidgetSnapshot([DEMO_SCHEDULE],Date.parse('2026-11-14T12:00:00Z'));
 assert.equal(snapshot.status,'no-data');
 assert.equal(snapshot.nextAt,0);
 assert.deepEqual(snapshot.times,[]);
});
test('iOS timeline changes entry at every prayer boundary and midnight',()=>{
 const at=prayerInstant('2026-11-14','06:00');
 const result=buildPrayerWidgetTimeline([base,next],at);
 assert.equal(result[0].snapshot.nextName,'İmsak');
 assert.equal(result[1].date,prayerInstant('2026-11-14','06:15'));
 assert.equal(result[1].snapshot.nextName,'Güneş');
 assert.ok(result.some(e=>e.date===prayerInstant('2026-11-15','00:00')));
});

test('Android native widget boundary plan changes prayer exactly at each published instant',()=>{
  const now=prayerInstant('2026-11-14','06:05');
  const entries=buildPrayerWidgetTimeline([base,next],now,100);
  assert.equal(entries[0].date,now);
  assert.equal(entries[0].snapshot.nextName,'İmsak');
  for(const [time,expectedNext] of [
    ['06:15','Güneş'],['07:43','Öğle'],['12:53','İkindi'],
    ['15:30','Akşam'],['17:54','Yatsı'],['19:17','İmsak'],
  ] as const){
    const at=prayerInstant('2026-11-14',time);
    const entry=entries.find(e=>e.date===at);
    assert.ok(entry,'missing Android transition at '+time);
    assert.equal(entry.snapshot.nextName,expectedNext);
    assert.equal(entry.snapshot.status,'ready');
    assert.equal(entry.snapshot.dateISO,'2026-11-14');
  }
  const midnight=entries.find(e=>e.date===prayerInstant('2026-11-15','00:00'));
  assert.ok(midnight,'offline Android midnight must be a local native transition');
  assert.equal(midnight.snapshot.dateISO,'2026-11-15');
  assert.equal(midnight.snapshot.nextName,'İmsak');
});

test('Android next-boundary plan never skips times after multiple delayed wakeups',()=>{
  const now=prayerInstant('2026-11-14','06:05');
  const entries=buildPrayerWidgetTimeline([base,next],now,100);
  const nativeAt=(time:number)=>{
    const eligible=entries.filter(entry=>entry.date<=time);
    return eligible[eligible.length-1]?.snapshot;
  };
  // Simulates Android delivering an inexact alarm 40 minutes late. It
  // chooses the correct current time state, not the missed alarm's props.
  assert.equal(nativeAt(prayerInstant('2026-11-14','07:05'))?.nextName,'Güneş');
  assert.equal(nativeAt(prayerInstant('2026-11-14','08:25'))?.nextName,'Öğle');
  assert.equal(nativeAt(prayerInstant('2026-11-15','00:05'))?.dateISO,'2026-11-15');
  assert.equal(nativeAt(prayerInstant('2026-11-15','20:00'))?.status,'no-data',
    'without a third verified day the widget must not invent tomorrow’s Imsak');
});

test('widget kerahet follows the home-screen rule and adds on-time boundaries',()=>{
  const settings={mode:'custom' as const,sunriseMinutes:45,preNoonMinutes:30,preSunsetMinutes:45};
  const now=prayerInstant('2026-11-14','06:05');
  const plain=buildPrayerWidgetTimeline([base,next],now,160);
  const entries=buildPrayerWidgetTimeline([base,next],now,160,settings);
  assert.ok(plain.every(e=>!e.snapshot.kerahat),'no settings: never a kerahet look');
  // Güneş 07:43 → +45; Öğle 12:53 → −30; Akşam 17:54 → −45.
  for(const [time,inside] of [
    ['07:43',true],['08:28',false],['12:23',true],['12:53',false],
    ['17:09',true],['17:54',false],
  ] as const){
    const entry=entries.find(e=>e.date===prayerInstant('2026-11-14',time));
    assert.ok(entry,'missing kerahet boundary at '+time);
    assert.equal(entry.snapshot.kerahat,inside,'kerahet at '+time);
  }
  // A kerahet edge is not a prayer: the next prayer and its clock stay put.
  const sunset=entries.find(e=>e.date===prayerInstant('2026-11-14','17:09'))!;
  assert.equal(sunset.snapshot.nextName,'Akşam');
  assert.equal(sunset.snapshot.nextAt,prayerInstant('2026-11-14','17:54'));
  assert.equal(entries.length,plain.length+6,'three extra edges per remaining day');
  const hidden=buildPrayerWidgetTimeline([base,next],now,160,{...settings,mode:'hidden'});
  assert.equal(hidden.length,plain.length);
  assert.ok(hidden.every(e=>!e.snapshot.kerahat));
});

test('widget carries the published Hijri date of the current day only',()=>{
  const at=prayerInstant('2026-11-14','10:00');
  const snapshot=buildPrayerWidgetSnapshot(
    [{...base,hijriDate:' 13 Cemaziyelevvel 1448 '},{...next,hijriDate:'14 Cemaziyelevvel 1448'}],at);
  assert.equal(snapshot.hijriDate,'13 Cemaziyelevvel 1448');
  assert.equal(buildPrayerWidgetSnapshot([base,next],at).hijriDate,'',
    'no published Hijri date: the widget hides the line instead of computing one');
});

test('widget timeline stays off the JS-thread critical path: one formatter, no rescans',()=>{
  // Root cause of multi-second freezes on Hermes: every zonedClock() built a
  // new Intl.DateTimeFormat and every snapshot re-verified the whole calendar
  // (≈15 000 constructions for a 16-day, 160-boundary widget publish).
  const days=Array.from({length:16},(_,i)=>({...base,
    dateISO:new Date(Date.UTC(2026,10,14+i)).toISOString().slice(0,10)}));
  const intl=Intl as unknown as {DateTimeFormat:unknown};
  const Real=Intl.DateTimeFormat;
  let built=0;
  intl.DateTimeFormat=function(locales?:string|string[],options?:Intl.DateTimeFormatOptions){
    built++;
    return new Real(locales,options);
  };
  try{
    const entries=buildPrayerWidgetTimeline(days,prayerInstant('2026-11-14','16:30'),160,
      {mode:'custom',sunriseMinutes:45,preNoonMinutes:30,preSunsetMinutes:45});
    assert.ok(entries.length>150,'a full 16-day publish ('+entries.length+' boundaries)');
  }finally{intl.DateTimeFormat=Real;}
  assert.ok(built<=1,'timeline built '+built+' Intl.DateTimeFormat instances');
  assert.throws(()=>prayerInstant('2026-11-14','24:00'),
    'cached instants never bypass validation of new clocks');
});
