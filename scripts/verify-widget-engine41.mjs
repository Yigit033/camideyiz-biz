import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFileSync(resolve(root,p),'utf8');
const p='apps/mobile/plugins/widget-native/';
const sched=read(p+'WidgetBoundaryScheduler.java');
const engine=read(p+'WidgetRenderPipeline.java');
const asyncReceiver=read(p+'WidgetBoundaryAsyncRefresh.java');
const bridge=read(p+'CamideyizWidgetBridge.java');
const plugin=read('apps/mobile/plugins/withWidgetBoundaryBridge.js');
// Theme marks are pixel derivations of the approved icon (build-widget-marks.mjs).
const MARK_SHA={
  dark:'232ffef37b07ffb55b14bdb0f6109a2deb37dcd10b8e262b11d45da049cc28cd',
  light:'a794b0dc3b12bbb1c60af553085661df4ef4f4e4d1c5b410ec6f30efc0309678',
};
for(const theme of ['dark','light']){
  const logo=readFileSync(resolve(root,'apps/mobile/assets/widget-mark-'+theme+'.png'));
  assert.equal(logo.readUInt32BE(16),256,'widget mark width');
  assert.equal(createHash('sha256').update(logo).digest('hex'),MARK_SHA[theme],
    'widget-mark-'+theme+'.png must be the build-widget-marks.mjs derivation');
}
assert.match(plugin,/'WidgetRenderPipeline.java'/);
assert.match(plugin,/'widget-mark-'\+theme\+'\.png'/);
assert.match(plugin,/'widget_brand_mark_'\+theme\+'\.png'/);
assert.doesNotMatch(plugin,/widget_brand_lockup/,'opaque square badge logo is retired');
const base=['widget_compact_prayer','widget_next_prayer','widget_prayer_day',
  'widget_prayer_focus','widget_prayer_strip','widget_ring_mini',
  'widget_ring_premium','widget_slim_prayer','widget_ring_square'];
for(const variant of base)for(const suffix of ['','_light']){
  const xml=read(p+variant+suffix+'.xml');
  assert.match(xml,/@drawable\/widget_brand_mark_(dark|light)"/);
  assert.doesNotMatch(xml,/android:text="Camideyiz Biz"|@drawable\/widget_brand_symbol/,
    'no duplicate brand TextView or old symbol: '+variant+suffix);
}
assert.match(bridge,/STATUS\.execute\(\(\)->/);
assert.match(engine,/CamideyizBitmapRender/);
assert.match(engine,/CamideyizRemoteViewsDispatch/);
assert.match(engine,/new LinkedBlockingQueue<Runnable>\(3\)/);
assert.match(engine,/WidgetBoundaryScheduler\.isCurrentGeneration\(generation\)/);
assert.match(engine,/WidgetBoundaryScheduler\.renderFinished/);
assert.match(engine,/WidgetBoundaryScheduler\.renderFailed/);
assert.match(sched,/WidgetRenderPipeline\.enqueue\(/);
assert.match(sched,/private static String\[\] familyKeys\(/);
assert.match(sched,/widgetFamilySignature/);
assert.match(sched,/BRAND_VERSION=5;/);
assert.match(sched,/nativeRenderPending/);
assert.match(sched,/reason\.endsWith\(launcherShortName\(i\)\)/);
assert.match(sched,/"launcher:update:all"\.equals\(reason\)/);
assert.match(asyncReceiver,/latestReason="launcher:update:all"/,
  'coalescing different providers must repaint ALL affected families');
assert.match(sched,/latestGeneration\+\+/);
assert.match(sched,/widget_day_countdown/);
assert.match(sched,/widget_ring_square_countdown/);
assert.match(engine,/dirty\[8\]&&installed\[8\]\.length>0/);
assert.match(plugin,/SquarePrayerRingWidgetProvider/);
assert.match(plugin,/widget_ring_square_info/);
for(let i=0;i<9;i++)
  assert.match(sched,new RegExp('if\\([a-zA-Z]+\\.length>0&&dirty\\['+i+'\\]&&isCurrentGeneration\\(generation\\)\\)'));
assert.match(asyncReceiver,/AtomicBoolean finished=new AtomicBoolean\(false\)/);
assert.match(asyncReceiver,/WidgetBoundaryScheduler\.refresh\(app,reason,finish\)/);
assert.match(asyncReceiver,/DEADLINE\.schedule\(\(\)->safeFinish\(pending\),8,TimeUnit\.SECONDS\)/);
assert.match(asyncReceiver,/ACTIVE_RECEIPTS\.remove\(pending\)==null/);
console.log('Widget 4.2: nine independently dirty widget families, complete brand, bounded workers, fixed 2x2 ring, native countdown and goAsync watchdog verified');
