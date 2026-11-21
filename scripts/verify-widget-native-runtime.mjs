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
const miniRingProvider=read('apps/mobile/plugins/widget-native/MiniPrayerRingWidgetProvider.java');
const premiumRingProvider=read('apps/mobile/plugins/widget-native/PremiumPrayerRingWidgetProvider.java');
const slimProvider=read('apps/mobile/plugins/widget-native/SlimPrayerWidgetProvider.java');
const squareRingProvider=read('apps/mobile/plugins/widget-native/SquarePrayerRingWidgetProvider.java');
for(const component of [receiver,nextProvider,dayProvider,compactProvider,focusProvider,
  miniRingProvider,premiumRingProvider,slimProvider,squareRingProvider]){
  assert.match(component,/WidgetBoundaryAsyncRefresh\.dispatch\(context,goAsync\(\),/,
    'every native widget broadcast must goAsync before doing calendar IO');
  assert.doesNotMatch(component,/WidgetBoundaryScheduler\.refresh\(/,
    'no synchronous native refresh on Android main thread');
}
assert.match(nextProvider,/void onDisabled\(Context context\)/);
assert.match(dayProvider,/void onDisabled\(Context context\)/);
assert.match(compactProvider,/void onDisabled\(Context context\)/);
assert.match(focusProvider,/void onDisabled\(Context context\)/);
assert.match(miniRingProvider,/void onDisabled\(Context context\)/);
assert.match(premiumRingProvider,/void onDisabled\(Context context\)/);
assert.match(slimProvider,/void onDisabled\(Context context\)/);
assert.match(squareRingProvider,/void onDisabled\(Context context\)/);
assert.match(configPlugin,/'SlimPrayerWidgetProvider'/);
assert.match(configPlugin,/'PrayerRingBitmapRenderer.java'/);
assert.match(configPlugin,/'MiniPrayerRingWidgetProvider'/);
assert.match(configPlugin,/'PremiumPrayerRingWidgetProvider'/);
assert.match(configPlugin,/'SquarePrayerRingWidgetProvider'/);
assert.match(asyncRefresh,/ScheduledThreadPoolExecutor\(1,/,
  'native widget coordinator must be a single ordered worker');
assert.match(asyncRefresh,/WORKER\.schedule\(\(\)->performBatch\(app\),DEBOUNCE_MS,TimeUnit\.MILLISECONDS\)/,
  'rapid launcher broadcasts must be coalesced');
assert.match(asyncRefresh,/for\(BroadcastReceiver\.PendingResult item:pending\)safeFinish\(item\)/,
  'every coalesced goAsync result must be finished after the native batch');
assert.match(asyncRefresh,/for\(BroadcastReceiver\.PendingResult item:PENDING\)safeFinish\(item\)/,
  'rejected native broadcast batch must still finish every PendingResult');
assert.match(nativeScheduler,/scheduleNext\(app,installed>0\?nextBoundary:0,now,forceAlarmRearm\(reason\)\)/,
  'no pinned widget must mean no alarm; boot/time changes must rearm');

const bridge=read('apps/mobile/plugins/widget-native/CamideyizWidgetBridge.java');
assert.match(bridge,/WidgetBoundaryAsyncRefresh\.executeBridge\(/,
  'ReactMethods must not do native storage, canvas, or RemoteViews on RN module queue');
for(const name of ['selectDistrict','reportTransfer','publishCalendar','refreshNow',
  'setAppearance']){
  const at=bridge.indexOf('public void '+name+'(');
  assert.ok(at>0,'bridge entrypoint '+name);
  assert.match(bridge.slice(at,at+450),/submit\(promise,/,
    'all native bridge methods must enqueue onto serial coordinator: '+name);
}
assert.match(bridge,/STATUS\.execute\(\(\)->/,
  'status read-only query must not queue behind bitmap and data writes');
assert.match(nativeScheduler,/lastRenderSignature/);
assert.match(nativeScheduler,/nativeSkippedRenders/);
assert.match(nativeScheduler,/alarmRearmRequiredThisProcess/);
console.log('Widget Engine 4.0: bridge queue, coalesced goAsync batches, idempotent rendering, process alarm recovery and zero-widget gating verified');
