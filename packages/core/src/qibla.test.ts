import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBearing,qiblaBearing,relativeQiblaAngle} from './qibla.ts';

test('Istanbul geodesic bearing toward Kaaba is around 151.6°',()=>{
  const bearing=qiblaBearing(41.0082,28.9784);
  assert.ok(Math.abs(bearing-151.62059)<.01);
});
test('device north heading and Qibla azimuth produce clockwise relative direction',()=>{
  const bearing=qiblaBearing(41.0082,28.9784);
  assert.ok(Math.abs(relativeQiblaAngle(bearing,0)-151.62059)<.01);
  assert.ok(Math.abs(relativeQiblaAngle(bearing,bearing))<.0001);
  assert.ok(Math.abs(relativeQiblaAngle(bearing,270)-241.62059)<.01);
});
test('bearing wraparound remains 0…360 and shortest alignment can be near 0',()=>{
  assert.equal(normalizeBearing(-10),350);
  assert.equal(relativeQiblaAngle(5,355),10);
  assert.equal(relativeQiblaAngle(355,5),350);
});
test('invalid coordinates fail closed rather than generating misleading directions',()=>{
  assert.throws(()=>qiblaBearing(95,40),RangeError);
  assert.throws(()=>qiblaBearing(0,181),RangeError);
  assert.throws(()=>qiblaBearing(NaN,40),RangeError);
  assert.throws(()=>qiblaBearing(21.4225,39.8262),RangeError);
});
