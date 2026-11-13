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
  assert.equal(nearestCenterRotation(-20,sectors[3]),22.5);
});
test('tangential velocity is zero at the center and direction-aware',()=>{
  assert.equal(tangentialVelocity(0,0,10,40),0);
  assert.ok(tangentialVelocity(100,0,0,100)>0);
  assert.ok(tangentialVelocity(100,0,0,-100)<0);
  assert.ok(tangentialVelocity(100,0,0,10000)<=260);
});
