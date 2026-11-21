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
const logo=readFileSync(resolve(root,'apps/mobile/assets/widget-brand-lockup.png'));
assert.equal(logo.readUInt32BE(16),128);
assert.equal(logo.readUInt32BE(20),128);
assert.equal(createHash('sha256').update(logo).digest('hex'),
  'b927d6e7422d357fef66712166649c7567097450dbbab8373858315eccd3a860',
  'widget asset must remain the user-supplied symbol + integrated wordmark');
assert.match(plugin,/'WidgetRenderPipeline.java'/);
assert.match(plugin,/widget-brand-lockup\.png/);
assert.match(plugin,/widget_brand_lockup\.png/);
const base=['widget_compact_prayer','widget_next_prayer','widget_prayer_day',
  'widget_prayer_focus','widget_prayer_strip','widget_ring_mini',
  'widget_ring_premium','widget_slim_prayer'];
for(const variant of base)for(const suffix of ['','_light']){
  const xml=read(p+variant+suffix+'.xml');
  assert.match(xml,/@drawable\/widget_brand_lockup/);
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
assert.match(sched,/BRAND_VERSION=2/);
assert.match(sched,/nativeRenderPending/);
assert.match(sched,/reason\.endsWith\(launcherShortName\(i\)\)/);
assert.match(sched,/latestGeneration\+\+/);
for(let i=0;i<8;i++)
  assert.match(sched,new RegExp('if\\([a-zA-Z]+\\.length>0&&dirty\\['+i+'\\]&&isCurrentGeneration\\(generation\\)\\)'));
assert.match(asyncReceiver,/AtomicBoolean finished=new AtomicBoolean\(false\)/);
assert.match(asyncReceiver,/WidgetBoundaryScheduler\.refresh\(app,reason,finish\)/);
assert.match(asyncReceiver,/DEADLINE\.schedule\(\(\)->safeFinish\(pending\),8,TimeUnit\.SECONDS\)/);
assert.match(asyncReceiver,/ACTIVE_RECEIPTS\.remove\(pending\)==null/);
console.log('Widget 4.1: user-supplied full logo, 8 dirty families, 2 bounded workers, generation fencing, 8-second goAsync watchdog verified');
