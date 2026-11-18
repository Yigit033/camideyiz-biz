/**
 * Regression for the real device report (18 Nov 2026):
 * the app is a compiled Android APK with CamideyizWidgetBridge loaded,
 * while Expo's appOwnership/expoGoConfig can incorrectly imply Expo Go.
 * Capability detection must not consult those inaccurate labels.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {widgetBridgeAvailable} from '../apps/mobile/src/features/native/widgetBridgeAvailability.ts';

const noop=async()=>'{ "supported": true }';
const native={getStatus:noop,publishCalendar:noop,selectDistrict:noop,refreshNow:noop};
assert.equal(widgetBridgeAvailable('android',native),true,
  'compiled Android APK with the bridge must sync regardless of Expo appOwnership');
assert.equal(widgetBridgeAvailable('ios',native),false);
assert.equal(widgetBridgeAvailable('web',native),false);
assert.equal(widgetBridgeAvailable('android',null),false,
  'Expo Go without the compiled bridge must not enable native widget calls');
assert.equal(widgetBridgeAvailable('android',{getStatus:noop,publishCalendar:noop}),false,
  'old APK with no district selection cannot safely publish new data');
assert.equal(widgetBridgeAvailable('android',{
  ...native,selectDistrict:'not a function',
}),false);

const read=p=>readFileSync(resolve(import.meta.dirname,'..',p),'utf8');
const wrapper=read('apps/mobile/src/features/native/nativeRuntime.ts');
const publisher=read('apps/mobile/src/features/widgets/widgetSync.android.ts');
const background=read('apps/mobile/src/features/widgets/widgetBackground.ts');
assert.match(wrapper,/widgetBridgeAvailable\(Platform\.OS,NativeModules\.CamideyizWidgetBridge\)/);
assert.match(publisher,/if\(!hasAndroidNativeWidgetBridge\(\)\)/);
assert.doesNotMatch(publisher,/isExpoGoRuntime/,
  'do not block compiled native bridge with Expo Go heuristics');
assert.match(background,/const enabled=\(\)=>Platform\.OS==='android'&&hasAndroidNativeWidgetBridge\(\)/);
assert.doesNotMatch(background,/isExpoGoRuntime/,
  'background TaskManager registration must use the same native capability');
assert.match(publisher,/await selectAndroidWidgetDistrict\(cityId\)/);
const adhan=read('apps/mobile/src/features/companion/nativeAdhan.ts');
const notification=read('apps/mobile/src/features/companion/notificationService.ts');
assert.match(adhan,/NativeModules\.CamideyizAdhanBridge/);
assert.doesNotMatch(adhan,/isExpoGoRuntime/,
  'a native APK must not lose exact ezan alarms due to false Expo Go markers');
assert.match(notification,/isExpoGoRuntime\(\)\&\&!hasAndroidNativeWidgetBridge\(\)/,
  'compiled native APK must keep Android notification channel options');

console.log('Widget 3.2: real native bridge detection succeeds for APK; unsupported Expo Go and old APK fail closed');
