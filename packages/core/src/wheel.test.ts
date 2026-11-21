import test from 'node:test';
import assert from 'node:assert/strict';
import {
  angleOfTouch, nearestCenterRotation, normalizeDegrees, sectorAtNeedle,
  shortestAngularDelta, tangentialVelocity,
} from './wheel.ts';

const sectors = [{from:0,to:90},{from:90,to:180},{from:180,to:270},{from:270,to:360}];
test('angles wrap continuously in both directions', () => {
  assert.equal(normalizeDegrees(730),10);
  assert.equal(normalizeDegrees(-350),10);
  assert.equal(shortestAngularDelta(359,1),2);
  assert.equal(shortestAngularDelta(1,359),-2);
});
test('clockwise touch is measured from 12 o’clock',()=>{
  assert.equal(angleOfTouch(100,0,100),0);
  assert.equal(angleOfTouch(200,100,100),90);
  assert.equal(angleOfTouch(100,200,100),180);
  assert.equal(angleOfTouch(0,100,100),-90);
});
test('fixed needle selects passing sector, not finger position',()=>{
  assert.equal(sectorAtNeedle(-40,sectors),0);
  assert.equal(sectorAtNeedle(-100,sectors),1);
  assert.equal(sectorAtNeedle(-280,sectors),3);
  assert.equal(sectorAtNeedle(-460,sectors),1);
});
test('external selection takes shortest path across zero degrees',()=>{
  assert.equal(nearestCenterRotation(-355,sectors[0]),-405);
  assert.equal(nearestCenterRotation(-20,sectors[3]),45);
});
test('tangential velocity is zero at the center and direction-aware',()=>{
  assert.equal(tangentialVelocity(0,0,10,40),0);
  assert.ok(tangentialVelocity(100,0,0,100)>0);
  assert.ok(tangentialVelocity(100,0,0,-100)<0);
  assert.ok(tangentialVelocity(100,0,0,10000)<=260);
});

test('automatic self-centering reaches live wedge after repeated full turns',()=>{
  const live={from:180,to:270};
  const center=(live.from+live.to)/2;
  for(const revolutions of [-6,-3,-1,0,1,3,6]){
    for(const offset of [-176,-83,0,62,174]){
      const start=revolutions*360+offset;
      const destination=nearestCenterRotation(start,live);
      assert.ok(Math.abs(destination-start)<=180,
        'return must take shortest turn even after many revolutions');
      assert.ok(Math.abs(normalizeDegrees(-destination)-center)<1e-8,
        'return must finish with live prayer centered at needle');
      assert.equal(sectorAtNeedle(destination,sectors),2);
    }
  }
});
test('steering can regrab during an unfinished return without losing angular continuity',()=>{
  const live={from:270,to:360};
  const initial=-5*360-105;
  const planned=nearestCenterRotation(initial,live);
  const halfway=initial+(planned-initial)*.38;
  const fingerDelta=shortestAngularDelta(358,7);
  assert.equal(fingerDelta,9);
  const resumed=halfway+fingerDelta;
  const final=nearestCenterRotation(resumed,live);
  assert.ok(Math.abs(final-resumed)<=180);
  assert.equal(sectorAtNeedle(final,sectors),3);
});
