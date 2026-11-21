/**
 * Widget Engine 4.3 contracts: on-time prayer switch, launcher-resolved
 * day/night theme, real light ring designs, picker previews and latest-wins
 * render back-pressure. Structural QA only: launcher re-inflation, exact
 * alarm delivery under Doze and colours still require a device APK test.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const read=p=>readFileSync(resolve(import.meta.dirname,'..',p),'utf8');
const p='apps/mobile/plugins/widget-native/';
const sched=read(p+'WidgetBoundaryScheduler.java');
const pipe=read(p+'WidgetRenderPipeline.java');
const ring=read(p+'PrayerRingBitmapRenderer.java');
const receiver=read(p+'WidgetBoundaryReceiver.java');
const coordinator=read(p+'WidgetBoundaryAsyncRefresh.java');
const plugin=read('apps/mobile/plugins/withWidgetBoundaryBridge.js');
const families=['widget_next_prayer','widget_prayer_day','widget_compact_prayer',
  'widget_prayer_focus','widget_prayer_strip','widget_ring_mini',
  'widget_ring_premium','widget_slim_prayer','widget_ring_square'];
const EXACT='android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED';

// 1. On-time prayer switch: exact when permitted, safe inexact fallback,
//    no negative Chronometer at the boundary.
assert.match(sched,/manager\.canScheduleExactAlarms\(\)/);
assert.match(sched,/if\(Build\.VERSION\.SDK_INT>=Build\.VERSION_CODES\.S\)\{\s*return manager\.canScheduleExactAlarms\(\);/,
  'canScheduleExactAlarms must be SDK-guarded (lint NewApi + Android 6–11)');
assert.match(sched,/setExactAndAllowWhileIdle\(AlarmManager\.RTC_WAKEUP,next,intent\)/);
assert.match(sched,/catch\(SecurityException revoked\)/);
assert.match(sched,/if\(!scheduledExact\)\{\s*manager\.setAndAllowWhileIdle\(AlarmManager\.RTC_WAKEUP,next,intent\)/);
assert.doesNotMatch(sched,/next\+1200/,'alarm must fire at the published minute');
assert.match(sched,/BOUNDARY_LEAD_MS=1500/);
assert.match(sched,/if\(at<=now\+BOUNDARY_LEAD_MS\)selection=/);
assert.match(sched,/local\.getBoolean\("nextAlarmExact",false\)==exact/,
  'granting exact-alarm access must re-arm an existing inexact alarm');
assert.match(sched,/result\.put\("nextAlarmExact"/);
assert.ok(receiver.includes(EXACT)&&plugin.includes(EXACT),
  'exact-alarm grant broadcast must reach the widget receiver');
assert.match(coordinator,/SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED/,
  'permission grant must survive broadcast coalescing as an alarm re-arm');

// 2. Day/night: launcher-resolved aliases, guarded setColorInt, no repaint churn.
const day=read(p+'widget_values.xml'),night=read(p+'widget_values_night.xml');
for(const name of families){
  assert.ok(day.includes('<item name="'+name+'_auto" type="layout">@layout/'+name+'_light</item>'),
    'day alias '+name);
  assert.ok(night.includes('<item name="'+name+'_auto" type="layout">@layout/'+name+'</item>'),
    'night alias '+name);
  assert.match(sched,new RegExp('R\\.layout\\.'+name+'_auto'),'scheduler must use '+name+'_auto');
  assert.ok(day.includes('<string name="'+name+'_description">'),'picker description '+name);
  const info=read(p+name+'_info.xml');
  assert.match(info,new RegExp('android:initialLayout="@layout/'+name+'_auto"'));
  assert.match(info,new RegExp('android:previewLayout="@layout/'+name+'_auto"'));
  assert.match(info,new RegExp('android:description="@string/'+name+'_description"'));
}
for(const d of ['widget_active','widget_strip_selected']){
  assert.ok(day.includes('@drawable/'+d+'_light')&&night.includes('@drawable/'+d+'_dark'));
}
assert.doesNotMatch(night,/<string /,'strings belong to the default values file only');
assert.match(plugin,/dir:'values-night'/);
assert.match(plugin,/to:'camideyiz_widget\.xml'/);
assert.match(plugin,/'widget_ring_track\.xml'/);
assert.match(sched,/look\.auto&&Build\.VERSION\.SDK_INT>=Build\.VERSION_CODES\.S\)\{\s*card\.setColorInt\(viewId,"setTextColor"/,
  'RemoteViews.setColorInt is API 31 and must be inline-guarded');
assert.match(sched,/Build\.VERSION\.SDK_INT>=Build\.VERSION_CODES\.S&&\s*"system"\.equals/);
assert.doesNotMatch(sched,/boolean light=lightTheme\(context\);/,
  'render pass must use the Look abstraction');
assert.doesNotMatch(sched,/card\.setTextColor\((labels|clocks|hourLabels|hourClocks)\[i\]/,
  'row colours must go through ink() so they follow day/night');
assert.match(sched,/themeKey\(context\)\+"\|"\+props\.optBoolean/,
  'family signatures must not churn on system day/night switches');

// 3. Real light designs for every ring; theme-neutral ring bitmap.
for(const name of ['widget_ring_mini','widget_ring_premium','widget_ring_square']){
  const dark=read(p+name+'.xml'),light=read(p+name+'_light.xml');
  assert.notEqual(dark,light,name+' light layout must not be a dark copy');
  assert.match(light,/android:background="@drawable\/widget_bg_light"/);
  assert.doesNotMatch(light,/#(F2F7FB|F1F7F8|B2C6D6|AEC7D4)/i,name+' light uses dark inks');
  for(const xml of [dark,light])assert.match(xml,/android:src="@drawable\/widget_ring_track"/);
}
assert.doesNotMatch(sched,/R\.drawable\.widget_strip_selected_dark:R\.drawable\.widget_row_clear/,
  'premium ring must not hard-code the dark highlight');
assert.match(ring,/render\(JSONArray times,long nowMs,int size\)/);
assert.doesNotMatch(ring,/light\?/,'ring bitmap must be theme-neutral');

// 4. Picker previews show prayer NAMES only, never fabricated clocks.
for(const [name,prefix] of [['widget_prayer_day','widget_day_label_'],
    ['widget_prayer_strip','widget_strip_label_'],
    ['widget_ring_premium','widget_ring_premium_label_']]){
  for(const suffix of ['','_light']){
    const xml=read(p+name+suffix+'.xml');
    ['İmsak','Güneş','Öğle','İkindi','Akşam','Yatsı'].forEach((label,i)=>{
      const tag=xml.match(new RegExp('<TextView[^>]*android:id="@\\+id/'+prefix+i+'"[^>]*>'))?.[0];
      assert.ok(tag?.includes('android:text="'+label+'"'),name+suffix+' default '+label);
    });
    assert.doesNotMatch(xml,/android:text="\d{2}:\d{2}"/,'no fabricated clocks in '+name+suffix);
  }
}

// 5. Latest-wins back-pressure: never reject new work, always finish evicted goAsync.
assert.match(pipe,/Runnable oldest=executor\.getQueue\(\)\.poll\(\);/);
assert.match(pipe,/if\(oldest instanceof Job\)\(\(Job\)oldest\)\.evict\(\);/);
assert.match(pipe,/void evict\(\)\{\s*evictedStaleJobs\+\+;\s*complete\(completed\);/);
assert.match(pipe,/RENDER\.execute\(new Job\(/);
assert.match(pipe,/DISPATCH\.execute\(new Job\(/);
assert.doesNotMatch(pipe,/AbortPolicy/);
assert.match(pipe,/nativeRenderQueueEvicted/);
assert.match(coordinator,/"engineRevision","4\.3"/);
console.log('Widget Engine 4.3: exact on-time switch with safe fallback, launcher day/night theme, real light rings, picker previews and latest-wins render queue verified');
