import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterQiblaHeading,headingFreshness,isUsableQiblaFix,
  shortestHeadingDelta,QIBLA_HEADING_EXPIRED_MS,
  QIBLA_POSITION_MAX_AGE_MS,normalizeReportedHeading,qiblaTiltState,
  magneticInterference,kaabaDistanceKm,
} from './qiblaTracking.ts';

test('negative true north near north (negative declination) is wrapped, -1 stays unknown',()=>{
 assert.equal(normalizeReportedHeading(-2.5,1.5),357.5,'Expo: (1.5° + -4° declination) % 360');
 assert.equal(normalizeReportedHeading(-1),-1,'-1 is the "no true north" sentinel');
 assert.equal(normalizeReportedHeading(42),42);
 assert.equal(normalizeReportedHeading(NaN),-1);
 assert.equal(normalizeReportedHeading(-120,10),-120,'implausible values are not invented');
});
test('fused profile follows a real fast turn immediately and lags less',()=>{
 const start=filterQiblaHeading(null,{trueHeading:10,accuracy:3},1000,'fused').filter!;
 const raw=filterQiblaHeading(start,{trueHeading:100,accuracy:3},1080,'raw');
 const fused=filterQiblaHeading(start,{trueHeading:100,accuracy:3},1080,'fused');
 assert.equal(raw.accepted,false,'raw profile holds an unconfirmed 90° spike');
 assert.equal(fused.accepted,true,'gyro-fused turns are real');
 const slow=filterQiblaHeading(start,{trueHeading:20,accuracy:3},1100,'raw').filter!;
 const quick=filterQiblaHeading(start,{trueHeading:20,accuracy:3},1100,'fused').filter!;
 assert.ok(Math.abs(shortestHeadingDelta(quick.angle,20))<Math.abs(shortestHeadingDelta(slow.angle,20)));
});
test('tilt gates guidance: flat, tilted warning, upright not actionable',()=>{
 assert.equal(qiblaTiltState(8),'flat');
 assert.equal(qiblaTiltState(35),'tilted');
 assert.equal(qiblaTiltState(70),'upright');
 assert.equal(qiblaTiltState(NaN),'flat','iOS / unknown tilt never blocks guidance');
});
test('magnetic interference uses the location model with hysteresis',()=>{
 assert.equal(magneticInterference(47,46),'none');
 assert.equal(magneticInterference(70,46),'interference');
 assert.equal(magneticInterference(54,46,'interference'),'interference','stays until <15%');
 assert.equal(magneticInterference(51,46,'interference'),'none');
 assert.equal(magneticInterference(120,-1),'interference','implausible without a model');
 assert.equal(magneticInterference(45,-1),'none');
 assert.equal(magneticInterference(-1,46),'unknown');
});
test('distance to the Kaaba is a plausible great-circle value',()=>{
 const istanbul=kaabaDistanceKm(41.0082,28.9784);
 assert.ok(istanbul>2350&&istanbul<2420,'Istanbul ≈ 2,385 km: '+istanbul);
 assert.ok(kaabaDistanceKm(21.4225,39.8262)<0.001);
 assert.throws(()=>kaabaDistanceKm(91,0));
});

test('shortest arc handles north wrap and invalid angles',()=>{
 assert.equal(shortestHeadingDelta(359,1),2);
 assert.equal(shortestHeadingDelta(1,359),-2);
 assert.equal(shortestHeadingDelta(20,85),65);
 assert.throws(()=>shortestHeadingDelta(NaN,2));
});
test('jitter is reduced while 359->1 crossing remains continuous',()=>{
 let state=filterQiblaHeading(null,{trueHeading:359,accuracy:3},1000).filter!;
 for(let i=1;i<=20;i++){
   const raw=i%2?1:359;
   const result=filterQiblaHeading(state,{trueHeading:raw,accuracy:3},1000+100*i);
   assert.equal(result.accepted,true);
   state=result.filter!;
 }
 assert.ok(Math.abs(shortestHeadingDelta(359,state.angle))<2,'no full rotation');
 assert.equal(state.accuracy,3);
});
test('one-off unrealistic spike is rejected, genuine sustained fast turn recovers',()=>{
 let state=filterQiblaHeading(null,{trueHeading:20,accuracy:3},1000).filter!;
 let result=filterQiblaHeading(state,{trueHeading:199,accuracy:3},1050);
 assert.equal(result.accepted,false);
 assert.equal(result.filter!.angle,20);
 state=result.filter!;
 result=filterQiblaHeading(state,{trueHeading:201,accuracy:3},1120);
 assert.equal(result.accepted,true,'second corroborating sample admits real movement');
 assert.ok(Math.abs(shortestHeadingDelta(20,result.filter!.angle))>10);
});
test('accuracy 0, denied true north, and invalid heading never yield trusted data',()=>{
 const stable=filterQiblaHeading(null,{trueHeading:60,accuracy:2},1500).filter!;
 for(const sample of [
  {trueHeading:-1,accuracy:3},{trueHeading:0,accuracy:0},
  {trueHeading:NaN,accuracy:3},{trueHeading:360,accuracy:3},
  {trueHeading:40,accuracy:1.2},
 ]){
   const out=filterQiblaHeading(stable,sample,1550);
   assert.equal(out.accepted,false);
   assert.equal(out.filter?.acceptedAt,1500);
 }
});
test('sensor interruptions distinguish live, recovering and stale without lying',()=>{
 assert.equal(headingFreshness(null,1000),'stale');
 assert.equal(headingFreshness(1000,1000),'live');
 assert.equal(headingFreshness(1000,4000),'recovering');
 assert.equal(headingFreshness(1000,1000+QIBLA_HEADING_EXPIRED_MS+1),'stale');
 const old=filterQiblaHeading(null,{trueHeading:30,accuracy:2},1000).filter!;
 const resumed=filterQiblaHeading(old,{trueHeading:180,accuracy:2},12000);
 assert.equal(resumed.accepted,true);
 assert.equal(resumed.filter?.angle,180);
 assert.equal(resumed.filter?.accuracy,2);
});
test('only valid, recent, sufficiently accurate non-mock position can be used',()=>{
 const good={timestamp:10_000,coords:{latitude:41,longitude:29,accuracy:60}};
 assert.equal(isUsableQiblaFix(good,20_000),true);
 assert.equal(isUsableQiblaFix({...good,mocked:true},20_000),false);
 assert.equal(isUsableQiblaFix({...good,timestamp:0},QIBLA_POSITION_MAX_AGE_MS+1),false);
 assert.equal(isUsableQiblaFix({...good,coords:{...good.coords,accuracy:4000}},20_000),false);
 assert.equal(isUsableQiblaFix({...good,coords:{...good.coords,latitude:91}},20_000),false);
 assert.equal(isUsableQiblaFix({...good,timestamp:30_000},20_000),false);
 assert.equal(isUsableQiblaFix({...good,coords:{...good.coords,accuracy:null}},20_000),false);
 assert.equal(isUsableQiblaFix(null,20_000),false);
});
