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

// Android app-widget broadcasts must never do JSON/disk/RemoteViews work on
// Android's UI thread. Registration must include the new async source.
const receiver=read('apps/mobile/plugins/widget-native/WidgetBoundaryReceiver.java');
const nextProvider=read('apps/mobile/plugins/widget-native/NextPrayerWidgetProvider.java');
const dayProvider=read('apps/mobile/plugins/widget-native/PrayerDayWidgetProvider.java');
const asyncRefresh=read('apps/mobile/plugins/widget-native/WidgetBoundaryAsyncRefresh.java');
const configPlugin=read('apps/mobile/plugins/withWidgetBoundaryBridge.js');
const nativeScheduler=read('apps/mobile/plugins/widget-native/WidgetBoundaryScheduler.java');
assert.match(configPlugin,/'WidgetBoundaryAsyncRefresh.java'/);
const compactProvider=read('apps/mobile/plugins/widget-native/CompactPrayerWidgetProvider.java');
const focusProvider=read('apps/mobile/plugins/widget-native/PrayerFocusWidgetProvider.java');
for(const component of [receiver,nextProvider,dayProvider,compactProvider,focusProvider]){
  assert.match(component,/WidgetBoundaryAsyncRefresh\.dispatch\(context,goAsync\(\),/,
    'every native widget broadcast must goAsync before doing calendar IO');
  assert.doesNotMatch(component,/WidgetBoundaryScheduler\.refresh\(/,
    'no synchronous native refresh on Android main thread');
}
assert.match(nextProvider,/void onDisabled\(Context context\)/);
assert.match(dayProvider,/void onDisabled\(Context context\)/);
assert.match(compactProvider,/void onDisabled\(Context context\)/);
assert.match(focusProvider,/void onDisabled\(Context context\)/);
assert.match(asyncRefresh,/Executors\.newSingleThreadExecutor\(/);
assert.match(asyncRefresh,/finally\s*\{[\s\S]*?pending\.finish\(\)/,
  'goAsync pending result must finish even if native update fails');
assert.match(asyncRefresh,/catch \(RejectedExecutionException error\) \{\s*pending\.finish\(\)/);
assert.match(nativeScheduler,/scheduleNext\(app,installed>0\?nextBoundary:0,now\)/,
  'no pinned widget must mean no unnecessary Android wakeup alarm');

console.log('Widget 3.3: bridge detection, async native receivers, completion and zero-widget alarm gating verified');
