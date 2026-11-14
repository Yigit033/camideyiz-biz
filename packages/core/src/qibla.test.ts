import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBearing,qiblaBearing,relativeQiblaAngle,qiblaGuidance} from './qibla.ts';

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


test('live guidance uses device heading, not fixed location label',()=>{
  const bearing=152;
  assert.deepEqual(
    qiblaGuidance(bearing,100),
    {direction:'right',turnDegrees:52,signedError:52,clockwiseAngle:52},
  );
  assert.deepEqual(
    qiblaGuidance(bearing,200),
    {direction:'left',turnDegrees:48,signedError:-48,clockwiseAngle:312},
  );
  assert.equal(qiblaGuidance(bearing,bearing).direction,'near');
  assert.equal(qiblaGuidance(bearing,149).direction,'near');
});
test('guidance picks the shortest rotation across north and at 180 degrees',()=>{
  assert.equal(qiblaGuidance(5,355).direction,'right');
  assert.equal(qiblaGuidance(5,355).turnDegrees,10);
  assert.equal(qiblaGuidance(355,5).direction,'left');
  assert.equal(qiblaGuidance(355,5).turnDegrees,10);
  assert.equal(qiblaGuidance(180,0).turnDegrees,180);
  assert.equal(qiblaGuidance(0,180).turnDegrees,180);
});
test('guidance varies by location while phone keeps same heading',()=>{
  const fromIstanbul=qiblaGuidance(qiblaBearing(41.0082,28.9784),90);
  const fromLondon=qiblaGuidance(qiblaBearing(51.5,-.1),90);
  assert.notEqual(fromIstanbul.turnDegrees,fromLondon.turnDegrees);
});
test('invalid bearings and tolerance fail closed',()=>{
  assert.throws(()=>qiblaGuidance(Number.NaN,0),RangeError);
  assert.throws(()=>qiblaGuidance(152,Infinity),RangeError);
  assert.throws(()=>qiblaGuidance(152,100,-1),RangeError);
});
