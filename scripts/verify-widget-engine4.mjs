/**
 * Widget Engine 4.0 — static native/concurrency contract gate.
 * It does not substitute Android Gradle compilation or physical device ANR
 * and battery/perf profiling.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const read=p=>readFileSync(resolve(import.meta.dirname,'..',p),'utf8');
const root='apps/mobile/plugins/widget-native/';
const bridge=read(root+'CamideyizWidgetBridge.java');
const worker=read(root+'WidgetBoundaryAsyncRefresh.java');
const scheduler=read(root+'WidgetBoundaryScheduler.java');
const service=read('apps/mobile/src/features/widgets/widgetBackground.ts');
const panel=read('apps/mobile/src/features/widgets/Widget3Diagnostics.tsx');
const plugin=read('apps/mobile/plugins/withWidgetBoundaryBridge.js');

assert.match(plugin,/'WidgetBoundaryAsyncRefresh.java'/);
assert.match(worker,/new ScheduledThreadPoolExecutor\(1,/);
assert.match(worker,/private static final long DEBOUNCE_MS=75/);
assert.match(worker,/synchronized\(GATE\)/);
assert.match(worker,/WORKER\.schedule\(\(\)->performBatch\(app\),DEBOUNCE_MS,TimeUnit\.MILLISECONDS\)/);
assert.match(worker,/mergedEvents\.incrementAndGet\(\)/);
assert.match(worker,/PENDING\.add\(pending\)/);
assert.match(worker,/finally\{[\s\S]*?for\(BroadcastReceiver\.PendingResult item:pending\)safeFinish\(item\)/);
assert.match(worker,/for\(BroadcastReceiver\.PendingResult item:PENDING\)safeFinish\(item\)/);
assert.match(worker,/pending\.finish\(\)/);
assert.match(bridge,/WidgetBoundaryAsyncRefresh\.executeBridge\(\(\)->/);
for(const name of ['selectDistrict','reportTransfer','publishCalendar','refreshNow','setAppearance','getStatus']){
  const at=bridge.indexOf('public void '+name+'(');
  assert.ok(at>=0,'Missing bridge method '+name);
  assert.match(bridge.slice(at,at+500),/submit\(promise,/,
    'no synchronous Scheduler calls from RN native-module queue: '+name);
}
assert.match(scheduler,/WidgetInventory inspectWidgetInventory\(/);
assert.match(scheduler,/Arrays\.sort\(sorted\)/,
  'same widget count but different installed host IDs must invalidate render cache');
assert.match(scheduler,/inventory\.signature\.equals\(local\.getString\("lastRenderSignature",""\)\)/);
assert.match(scheduler,/if\(unchanged\)\{/);
assert.match(scheduler,/skippedUnchangedRenders\+\+/);
assert.match(scheduler,/installed=renderWidgets\(app,selection,inventory\.ids\)/);
assert.match(scheduler,/local\.edit\(\)\.putString\("lastRenderSignature",inventory\.signature\)/);
assert.match(scheduler,/reason\.startsWith\("launcher:update:"\)/,
  'host repaint after launcher reset may not use the unchanged snapshot fastpath');
assert.match(scheduler,/alarmRearmRequiredThisProcess/,
  'first process run must rearm an alarm canceled by Android force-stop');
assert.match(scheduler,/forceAlarmRearm\(reason\)/);
assert.match(scheduler,/manager\.setAndAllowWhileIdle\(AlarmManager\.RTC_WAKEUP/,
  'published prayer boundary must retain Doze-aware best-effort alarm');
assert.match(scheduler,/result\.put\("nativeRenderMs",lastRenderMs\)/);
assert.match(scheduler,/result\.put\("nativeCommitMs",lastCommitMs\)/);
assert.match(scheduler,/WidgetBoundaryAsyncRefresh\.appendMetrics\(result\)/);
assert.match(scheduler,/for\(int i=0;i<NAMES\.length;i\+\+\)counts\[i\]=installedCount\(context,NAMES\[i\]\)/);
const status=scheduler.slice(scheduler.indexOf('  public static JSONObject status('));
assert.equal((status.match(/installedCount\(context,/g)||[]).length,1,
  'status must not query each widget twice');
assert.match(service,/nativeHealthy&&!needsNetwork/,
  'WorkManager must avoid native repaint when validated data is healthy');
assert.match(service,/if\(AppState\.currentState==='active'\)return true/,
  'headless background refresh must yield to foreground app');
assert.doesNotMatch(service,/const recoveredAtStart=await recoverPrayerWidgets\(place\.id\)/,
  'unconditional native manual repair causes eight full repaints');
assert.doesNotMatch(panel,/await native\.refreshNow\(\)/,
  'manual refresh should not repaint all widgets twice');
assert.match(panel,/nativeBridgeQueueWaitMs/);
assert.match(panel,/nativeCoalescedEvents/);
assert.match(panel,/nativeSkippedRenders/);
const headlessTask=read('apps/mobile/src/features/widgets/widgetTaskRegistration.ts');
const headlessGate=read('apps/mobile/src/features/widgets/widgetHeadlessHealthGate.ts');
assert.match(headlessTask,/await import\('\.\/widgetHeadlessHealthGate'\)/);
assert.match(headlessTask,/if\(await canSkipWidgetHeadlessRefresh\(\)\)/);
assert.ok(headlessTask.indexOf('canSkipWidgetHeadlessRefresh()')<
  headlessTask.indexOf("await import('./widgetBackground')"),
  'heavy calendar module must import only after native headless health gate');
assert.doesNotMatch(headlessGate.split('\n')
  .filter(line=>line.trim().startsWith('import ')).join('\n'),
  /prayerApi|notificationService|AsyncStorage|@camideyiz\/core/,
  'health gate must not import heavyweight provider, storage or notifications');
console.log('Widget Engine 4.0 QA: async bridge, debounced broadcasts, dirty-only RemoteViews, alarm rearm, 8-count status, lightweight headless gate and native timing diagnostics OK');
