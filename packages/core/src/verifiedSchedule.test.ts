import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_SCHEDULE} from './prayer.ts';
import {calculateVerifiedPhase,validateTriplet} from './verifiedSchedule.ts';
const days=[
 {...DEMO_SCHEDULE,isDemo:false,dateISO:'2026-11-13'},
 {...DEMO_SCHEDULE,isDemo:false,dateISO:'2026-11-14'},
 {...DEMO_SCHEDULE,isDemo:false,dateISO:'2026-11-15',times:DEMO_SCHEDULE.times.map((v,i)=>
   i===0?{...v,time:'05:32'}:v)},
];
const stamped=days.map(d=>({...d,source:'diyanet-awqat-salah',cityId:123,
  fetchedAt:new Date().toISOString(),hijriDate:null}));
test('next imsak uses the following day, not today again',()=>{
  const phase=calculateVerifiedPhase(days[0],days[1],days[2],22*3600);
  assert.equal(phase.current.key,'yatsi');
  assert.equal(phase.next.time,'05:32');
  assert.equal(phase.secondsRemaining,7*3600+32*60);
});
test('before imsak previous boundary uses yesterday isha',()=>{
  const p=calculateVerifiedPhase(days[0],days[1],days[2],4*3600);
  assert.equal(p.current.key,'yatsi');
  assert.equal(p.next.time,'05:31');
  assert.equal(p.secondsRemaining,91*60);
  assert.ok(p.progress>0&&p.progress<1);
});
test('middle of day delegates to ordered boundaries',()=>{
  const p=calculateVerifiedPhase(days[0],days[1],days[2],17*3600);
  assert.equal(p.next.key,'aksam');
  assert.ok(p.progress>0&&p.progress<1);
});
test('verified response validates 3 consecutive dates and ID',()=>{
  const response={source:'diyanet-awqat-salah',dateISO:'2026-11-14',
    city:{id:123,name:'Kadıköy',state_id:34},previous:stamped[0],today:stamped[1],next:stamped[2]};
  assert.equal(validateTriplet(response,123,'2026-11-14').today.dateISO,'2026-11-14');
  assert.throws(()=>validateTriplet(response,42,'2026-11-14'));
  assert.throws(()=>validateTriplet({...response,next:{...stamped[2],dateISO:'2026-11-17'}},123,'2026-11-14'));
  assert.throws(()=>validateTriplet({...response,today:{...stamped[1],isDemo:true}},123,'2026-11-14'));
});
