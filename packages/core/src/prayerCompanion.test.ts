import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_SCHEDULE,PRAYER_KEYS} from './prayer.ts';
import {DEFAULT_ALERT_SETTINGS,prayerInstant,validateAlertSettings,
  createPrayerAlertPlan,buildPrayerWidgetSnapshot,buildPrayerWidgetTimeline} from './prayerCompanion.ts';
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
