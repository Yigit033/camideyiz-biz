import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_SCHEDULE, formatCountdown, nextPrayerAtSeconds, timeToMinutes, zonedClock} from './prayer.ts';
import {normalizeBearing, qiblaBearing, relativeQiblaAngle} from './qibla.ts';

test('HH:MM validation', () => {
  assert.equal(timeToMinutes('16:09'), 969);
  assert.throws(() => timeToMinutes('25:12'),RangeError);
  assert.throws(() => timeToMinutes('09:60'),RangeError);
});
test('next prayer after noon', () => {
  const r=nextPrayerAtSeconds(DEMO_SCHEDULE,14*3600);
  assert.equal(r.prayer.key,'ikindi');
  assert.equal(r.secondsRemaining,(16*60+9-14*60)*60);
});
test('exact boundary moves to the next event', () => {
  assert.equal(nextPrayerAtSeconds(DEMO_SCHEDULE,969*60).prayer.key,'aksam');
});
test('crosses midnight without negative countdown', () => {
  const r=nextPrayerAtSeconds(DEMO_SCHEDULE,23*3600);
  assert.equal(r.prayer.key,'imsak');assert.equal(r.secondsRemaining,(6*60+31)*60);
});
test('countdown formatting',() => assert.equal(formatCountdown(5058),'01:24:18'));
test('explicit Istanbul timezone',() => {
  const v=zonedClock(new Date('2026-11-13T12:00:04Z'),'Europe/Istanbul');
  assert.equal(v.dateISO,'2026-11-13');assert.equal(v.secondsOfDay,15*3600+4);
});
test('normalized qibla bearing',()=>{
  const bearing=qiblaBearing(41.0082,28.9784);
  assert.ok(bearing>140&&bearing<165);assert.equal(normalizeBearing(-45),315);
  assert.equal(relativeQiblaAngle(150,200),310);
});
test('invalid coordinates',()=> assert.throws(()=>qiblaBearing(200,29),RangeError));
