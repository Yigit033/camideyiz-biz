/**
 * Kıble 3.0 contracts: fused tilt-aware Android compass, UI-thread needle,
 * honest guidance gating (tilt, calibration, interference, freshness) and
 * correct handling of negative-declination true north. Structural QA only —
 * real heading accuracy must be checked against a known reference on device.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const read=p=>readFileSync(resolve(import.meta.dirname,'..',p),'utf8');
const module_=read('apps/mobile/plugins/compass-native/CamideyizCompassModule.java');
const plugin=read('apps/mobile/plugins/withNativeCompass.js');
const app=JSON.parse(read('apps/mobile/app.json')).expo;
const engine=read('apps/mobile/src/features/qibla/useQiblaEngine.ts');
const bridge=read('apps/mobile/src/features/qibla/nativeCompass.ts');
const art=read('apps/mobile/src/features/qibla/QiblaArtwork.tsx');
const screen=read('apps/mobile/src/app/(tabs)/qibla.tsx');
const pkg=JSON.parse(read('apps/mobile/package.json'));

// 1. Native fused compass: rotation vector, off the UI thread, throttled.
assert.match(module_,/Sensor\.TYPE_ROTATION_VECTOR/);
assert.match(module_,/Sensor\.TYPE_GEOMAGNETIC_ROTATION_VECTOR/,'gyro-less fallback');
assert.match(module_,/new HandlerThread\("CamideyizCompass"\)/);
assert.match(module_,/registerListener\(this,rotation,SensorManager\.SENSOR_DELAY_GAME,handler\)/);
assert.match(module_,/MIN_EMIT_MS=33/);
assert.match(module_,/double east=matrix\[1\],north=matrix\[4\];/,'heading = top-edge (+Y) projection');
assert.match(module_,/Math\.acos\(Math\.max\(-1,Math\.min\(1,matrix\[8\]\)\)\)/,'tilt from horizontal');
assert.match(module_,/event\.values\[4\]/,'sensor heading-error estimate');
assert.match(module_,/getFieldStrength\(\)\/1000\.0/,'expected field (nT → µT) for interference');
assert.match(module_,/\(magnetic\+declination\+360f\)%360f/,'true north never negative');
assert.match(module_,/hasActiveReactInstance\(\)/);
assert.match(module_,/public synchronized void stop\(\)[\s\S]*?unregisterListener\(this\)[\s\S]*?quitSafely\(\)/);
assert.match(plugin,/add\(CamideyizCompassPackage\(\)\)/);
assert.ok(app.plugins.includes('./plugins/withNativeCompass'),'CNG plugin registered');

// 2. Engine: fused first, Expo fallback, declination from the same fix.
assert.match(engine,/if\(await nativeCompassAvailable\(\)\)/);
assert.match(engine,/Location\.watchHeadingAsync\(/,'iOS / Expo Go fallback retained');
assert.match(engine,/setNativeCompassLocation\(fix\.coords\.latitude,fix\.coords\.longitude,fix\.coords\.altitude\)/);
assert.match(engine,/normalizeReportedHeading\(reading\.trueHeading,reading\.magHeading\)/g);
assert.equal((engine.match(/normalizeReportedHeading\(/g)??[]).length>=2,true,'both sources normalized');
assert.match(engine,/reading\.quality,'fused',now/);
assert.match(engine,/reading\.accuracy,'raw',Date\.now\(\)/);
assert.match(bridge,/emitter\.addListener\('CamideyizCompass'/);
assert.match(bridge,/native\.stop\(\);/,'unsubscribe stops the sensors');

// 3. Performance: per-sample motion is UI-thread only.
assert.match(engine,/shared\.value=withTiming\(/);
assert.match(engine,/shared\.value=previous-turns;\s*next-=turns;/,
  're-basing long spins must jump invisibly before animating');
assert.match(engine,/TEXT_UPDATE_MS=110/);
assert.doesNotMatch(engine,/setHeading\(result\.filter!\.angle\)/,
  'raw per-sample heading must not re-render the screen');
assert.match(art,/transform:\[\{rotate: needleAngle\.value\+'deg'\}\]/);
assert.match(art,/transform:\[\{rotate: \(-northAngle\.value\)\+'deg'\}\]/);
assert.doesNotMatch(art,/SvgText/,'cardinal letters are not rebuilt as SVG per sample');
assert.match(screen,/needleAngle=\{needleAngle\} northAngle=\{northAngle\}/);

// 4. Honest guidance.
assert.match(screen,/compassAccuracy>=2&&tilt!=='upright'/);
assert.match(screen,/const aligned=guidance\?\.direction==='near'&&compassAccuracy===3&&\s*!disturbed&&tilt==='flat';/);
assert.match(screen,/'Telefonu yere paralel tut'/);
assert.match(screen,/'Manyetik parazit algılandı'/);
assert.match(screen,/QiblaCalibrationGuide/);
assert.match(art,/withRepeat\(withTiming\(1,\{duration:2600/);
assert.match(screen,/activateKeepAwakeAsync\(KEEP_AWAKE_TAG\)/);
assert.match(screen,/deactivateKeepAwake\(KEEP_AWAKE_TAG\)/);
assert.ok(pkg.dependencies['expo-keep-awake'],'keep-awake declared explicitly');
console.log('Kıble 3.0: fused tilt-aware compass off the UI thread, ±° error, interference and tilt gating, negative-declination fix, UI-thread needle and keep-awake verified');
