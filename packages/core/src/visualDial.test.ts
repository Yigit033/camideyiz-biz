import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_SCHEDULE,timeToMinutes} from './prayer.ts';
import {makeVisualDialSectors,clockSecondsToVisualAngle,nearestLiveDialRotation} from './visualDial.ts';
test('linear 24-hour sectors cover full 360 with no holes or overlap',()=>{
  const s=makeVisualDialSectors(DEMO_SCHEDULE.times);
  assert.equal(s.length,6);
  assert.equal(s[0].from,0);
  assert.equal(s[s.length-1].to,360);
  for(let i=0;i<s.length;i++){
    assert.ok(s[i].to>s[i].from);
    if(i)assert.ok(Math.abs(s[i].from-s[i-1].to)<1e-8);
  }
});
test('each prayer wedge is its exact civil-time duration / 24 hours',()=>{
  const s=makeVisualDialSectors(DEMO_SCHEDULE.times);
  const mins=DEMO_SCHEDULE.times.map(x=>timeToMinutes(x.time));
  for(let i=0;i<s.length;i++){
    const span=i<5?mins[i+1]-mins[i]:1440-mins[i]+mins[0];
    const expected=span/1440*360;
    assert.ok(Math.abs((s[i].to-s[i].from)-expected)<1e-8);
  }
  const overnight=1440-timeToMinutes('20:46')+timeToMinutes('05:31');
  assert.ok(Math.abs((s[5].to-s[5].from)-overnight/1440*360)<1e-8);
  assert.ok(s[5].to-s[5].from>130,'overnight must be visibly larger');
});
test('48-hour prayer boundaries still map civil clock times correctly',()=>{
  const times=[
    {key:'imsak' as const,label:'İmsak',time:'06:15'},
    {key:'gunes' as const,label:'Güneş',time:'07:42'},
    {key:'ogle' as const,label:'Öğle',time:'12:52'},
    {key:'ikindi' as const,label:'İkindi',time:'15:28'},
    {key:'aksam' as const,label:'Akşam',time:'17:52'},
    {key:'yatsi' as const,label:'Yatsı',time:'19:15'},
  ];
  const sectors=makeVisualDialSectors(times);
  const yatsi=sectors[5];
  assert.ok((yatsi.to-yatsi.from)>(sectors[1].to-sectors[1].from));
  // Nonlinear shifting must never affect actual 24h start/stop angles.
  for(let i=0;i<times.length;i++)
    assert.ok(Math.abs(clockSecondsToVisualAngle(timeToMinutes(times[i].time)*60,
      times,sectors)-sectors[i].from)<1e-8);
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

test('a continuously rotating dial tracks real seconds, wraps smoothly at imsak',()=>{
 const s=makeVisualDialSectors(DEMO_SCHEDULE.times);
 const clocks=[19*3600,21*3600,23*3600,86400-1];
 let rotation=-clockSecondsToVisualAngle(clocks[0],DEMO_SCHEDULE.times,s);
 for(const now of clocks.slice(1)){
   const angle=clockSecondsToVisualAngle(now,DEMO_SCHEDULE.times,s);
   const next=nearestLiveDialRotation(rotation,angle);
   assert.ok(next<rotation,'clock advance should rotate the dial in one direction');
   rotation=next;
 }
 const atImsak=clockSecondsToVisualAngle(timeToMinutes(DEMO_SCHEDULE.times[0].time)*60,
   DEMO_SCHEDULE.times,s);
 const boundary=nearestLiveDialRotation(rotation,atImsak);
 assert.ok(Math.abs(boundary-rotation)<1,'should not jump a revolution at next imsak');
 assert.ok(Math.abs((rotation-boundary))<1);
 assert.throws(()=>nearestLiveDialRotation(NaN,30),RangeError);
 assert.throws(()=>nearestLiveDialRotation(0,-1),RangeError);
 assert.throws(()=>nearestLiveDialRotation(0,361),RangeError);
});
