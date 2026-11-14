import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_SCHEDULE} from './prayer.ts';
import {
  calculatePrayerPhase,calculateTimeAwareness,indicativeKerahatWindows,minutesToNextEvent,
} from './timeline.ts';

test('continuous phase progress between ikindi and akşam',()=>{
  const a=calculatePrayerPhase(DEMO_SCHEDULE,16*3600+9*60);
  assert.equal(a.next.key,'aksam');
  assert.equal(a.progress,0);
  const midpoint=(16*60+9+19*60+21)/2*60;
  const b=calculatePrayerPhase(DEMO_SCHEDULE,midpoint);
  assert.ok(Math.abs(b.progress-0.5)<.00001);
  assert.ok(b.secondsRemaining>0);
});
test('after yatsi, progress rolls into following imsak',()=>{
  const a=calculatePrayerPhase(DEMO_SCHEDULE,21*3600);
  const b=calculatePrayerPhase(DEMO_SCHEDULE,23*3600);
  assert.equal(a.next.key,'imsak');
  assert.ok(b.progress>a.progress);
  const c=calculatePrayerPhase(DEMO_SCHEDULE,3*3600);
  assert.equal(c.next.key,'imsak');
  assert.ok(c.progress>b.progress);
});
test('urgency thresholds are deterministic',()=>{
  const ak=19*3600+21*60;
  assert.equal(calculatePrayerPhase(DEMO_SCHEDULE,ak-46*60).urgency,'normal');
  assert.equal(calculatePrayerPhase(DEMO_SCHEDULE,ak-45*60).urgency,'approaching');
  assert.equal(calculatePrayerPhase(DEMO_SCHEDULE,ak-15*60).urgency,'imminent');
  assert.equal(calculatePrayerPhase(DEMO_SCHEDULE,ak).next.key,'yatsi');
});
test('three indicative kerahat periods are distinct and bounded',()=>{
  const w=indicativeKerahatWindows(DEMO_SCHEDULE);
  assert.deepEqual(w.map(x=>x.kind),['sunrise','zenith','sunset']);
  assert.deepEqual(w.map(x=>[x.startSeconds/60,x.endSeconds/60]),[
    [7*60+2,7*60+47],[12*60+38,12*60+48],[18*60+36,19*60+21],
  ]);
});
test('indicative warnings start and end at precise sample boundary',()=>{
  const at=calculateTimeAwareness(DEMO_SCHEDULE,18*3600+36*60,'2026-11-13',true);
  assert.equal(at.restriction?.kind,'sunset');
  assert.equal(at.usableForGuidance,false);
  const end=calculateTimeAwareness(DEMO_SCHEDULE,19*3600+21*60,'2026-11-13',true);
  assert.equal(end.restriction,null);
});
test('source switch prevents demo restriction guidance without explicit opt-in',()=>{
  const s=calculateTimeAwareness(DEMO_SCHEDULE,18*3600+50*60,'2026-11-13');
  assert.equal(s.restriction,null);
  assert.deepEqual(s.indicativeWindows,[]);
  assert.equal(s.usableForGuidance,false);
});
test('expired non-demo schedules cannot produce guidance',()=>{
  const expired={...DEMO_SCHEDULE,isDemo:false};
  const phase=calculateTimeAwareness(expired,18*3600,'2026-11-14',true);
  assert.equal(phase.usableForGuidance,false);
  assert.equal(phase.restriction,null);
  assert.deepEqual(phase.indicativeWindows,[]);
});
test('invalid daily schedule is rejected instead of silently producing wrong progress',()=>{
  const bad={...DEMO_SCHEDULE,times:[...DEMO_SCHEDULE.times].reverse()};
  assert.throws(()=>calculatePrayerPhase(bad,10*3600),RangeError);
  assert.throws(()=>calculatePrayerPhase(DEMO_SCHEDULE,86400),RangeError);
  assert.throws(()=>indicativeKerahatWindows(DEMO_SCHEDULE,{preSunsetMinutes:1000}),RangeError);
});
test('minutesToNextEvent uses next minute ceiling',()=>{
  assert.equal(minutesToNextEvent(14*60+2),'15 dk');
  assert.equal(minutesToNextEvent(60*60+1),'1 sa 1 dk');
});
