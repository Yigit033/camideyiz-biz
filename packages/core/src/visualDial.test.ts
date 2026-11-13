import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_SCHEDULE,timeToMinutes} from './prayer.ts';
import {makeVisualDialSectors,clockSecondsToVisualAngle} from './visualDial.ts';
test('nonlinear sectors cover full 360 with no holes or overlap',()=>{
  const s=makeVisualDialSectors(DEMO_SCHEDULE.times);
  assert.equal(s.length,6);
  assert.equal(s[0].from,0);
  assert.equal(s[s.length-1].to,360);
  for(let i=0;i<s.length;i++){
    assert.ok(s[i].to>s[i].from);
    if(i)assert.ok(Math.abs(s[i].from-s[i-1].to)<1e-8);
  }
});
test('overnight Yatsi sector is more balanced than linear time',()=>{
  const s=makeVisualDialSectors(DEMO_SCHEDULE.times);
  const yatsi=s[5];
  const minutes=1440-timeToMinutes('20:46')+timeToMinutes('05:31');
  const linearDegrees=minutes/1440*360;
  assert.ok(yatsi.to-yatsi.from<linearDegrees);
  assert.ok(yatsi.to-yatsi.from<100);
});
test('mapping respects boundary at every prayer and midnight',()=>{
  const s=makeVisualDialSectors(DEMO_SCHEDULE.times);
  DEMO_SCHEDULE.times.forEach((t,i)=>{
    assert.ok(Math.abs(clockSecondsToVisualAngle(timeToMinutes(t.time)*60,DEMO_SCHEDULE.times,s)-s[i].from)<1e-8);
  });
  const midnight=clockSecondsToVisualAngle(0,DEMO_SCHEDULE.times,s);
  assert.ok(midnight>s[5].from&&midnight<360);
  const beforeImsak=clockSecondsToVisualAngle(timeToMinutes('05:30')*60,DEMO_SCHEDULE.times,s);
  assert.ok(beforeImsak>midnight&&beforeImsak<360);
});
test('rejects invalid angle inputs and unordered prayer times',()=>{
  const times=DEMO_SCHEDULE.times;
  const s=makeVisualDialSectors(times);
  assert.throws(()=>clockSecondsToVisualAngle(86400,times,s),RangeError);
  assert.throws(()=>clockSecondsToVisualAngle(-2,times,s),RangeError);
  assert.throws(()=>clockSecondsToVisualAngle(100,times,s.slice(1)),RangeError);
  assert.throws(()=>makeVisualDialSectors([...times].reverse()),RangeError);
});
