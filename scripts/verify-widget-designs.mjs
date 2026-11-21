/**
 * Widget Design 7.0 — native launcher first, 9 variants, countdown-first.
 * Structural QA only: physical launcher scaling and UI jank require APK tests.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const read=p=>readFileSync(resolve(import.meta.dirname,'..',p),'utf8');
const p='apps/mobile/plugins/widget-native/';
const plugin=read('apps/mobile/plugins/withWidgetBoundaryBridge.js');
const scheduler=read(p+'WidgetBoundaryScheduler.java');
const pipe=read(p+'WidgetRenderPipeline.java');
const variants=[
  'widget_compact_prayer','widget_next_prayer','widget_prayer_day',
  'widget_prayer_focus','widget_prayer_strip','widget_ring_mini',
  'widget_ring_premium','widget_slim_prayer','widget_ring_square',
];
const clocks={
  widget_compact_prayer:'widget_compact_countdown',
  widget_next_prayer:'widget_next_countdown',
  widget_prayer_day:'widget_day_countdown',
  widget_prayer_focus:'widget_focus_countdown',
  widget_prayer_strip:'widget_strip_countdown',
  widget_ring_mini:'widget_ring_mini_countdown',
  widget_ring_premium:'widget_ring_premium_countdown',
  widget_slim_prayer:'widget_slim_countdown',
  widget_ring_square:'widget_ring_square_countdown',
};
const secondary={
 widget_compact_prayer:'widget_compact_time',
 widget_next_prayer:'widget_next_time',
 widget_prayer_focus:'widget_focus_current',
 widget_prayer_strip:'widget_strip_time_0',
 widget_ring_mini:'widget_ring_mini_time',
 widget_ring_premium:'widget_ring_premium_next',
 widget_slim_prayer:'widget_slim_time',
 widget_ring_square:'widget_ring_square_next',
 widget_prayer_day:'widget_day_time_0',
};
function element(xml,id){
  const tags=[...xml.matchAll(/<(TextView|Chronometer|LinearLayout|ImageView)\b[^<>]*\/?>/g)].map(x=>x[0]);
  const tag=tags.find(t=>t.includes('android:id="@+id/'+id+'"'));
  assert.ok(tag,'Missing ID '+id);
  return tag;
}
function font(xml,id){
  const tag=element(xml,id),m=tag.match(/android:textSize="(\d+)sp"/);
  assert.ok(m,'Missing text size '+id);
  return Number(m[1]);
}
for(const kind of variants){
  const info=read(p+kind+'_info.xml');
  assert.match(info,/android:updatePeriodMillis="1800000"/);
  assert.match(info,/android:widgetCategory="home_screen\|keyguard"/);
  assert.ok(plugin.includes("'"+kind+"_info.xml'"),'CNG missing '+kind+'_info.xml');
  for(const suffix of ['', '_light']){
    const file=kind+suffix+'.xml',xml=read(p+file);
    assert.ok(plugin.includes("'"+file+"'"),'CNG missing '+file);
    assert.match(xml,/xmlns:android=/);
    assert.match(xml,/@drawable\/widget_bg/);
    assert.match(xml,/@drawable\/widget_brand_lockup/);
    assert.doesNotMatch(xml,/<View\b|android:text="Camideyiz Biz"|@drawable\/widget_brand_symbol/,
      'Native RemoteViews must use supported tags and a SINGLE supplied logo: '+file);
    assert.doesNotMatch(xml,/Pendik|Tuzla|12:54|28:40/,
      'Initial widget layouts must not ship fabricated clocks/locations');
    assert.match(element(xml,clocks[kind]),/^<Chronometer\b/);
    assert.match(element(xml,clocks[kind]),/android:singleLine="true"/);
    const hero=font(xml,clocks[kind]),comparison=font(xml,secondary[kind]);
    assert.ok(hero>comparison,kind+suffix+' countdown must dominate its next clock/name ('+
      hero+' vs '+comparison+')');
  }
}
const comp=read(p+'widget_compact_prayer.xml');
assert.ok(font(comp,clocks.widget_compact_prayer)>=15);
assert.ok(font(comp,'widget_compact_time')<=11);
assert.match(read(p+'widget_compact_prayer_info.xml'),/targetCellWidth="1"/);
assert.match(read(p+'widget_compact_prayer_info.xml'),/targetCellHeight="1"/);
assert.match(read(p+'widget_slim_prayer_info.xml'),/targetCellWidth="1"/);
assert.match(read(p+'widget_slim_prayer_info.xml'),/targetCellHeight="2"/);
const square=read(p+'widget_ring_square_info.xml');
assert.match(square,/targetCellWidth="2"/);
assert.match(square,/targetCellHeight="2"/);
assert.match(square,/resizeMode="none"/);
assert.match(read(p+'widget_ring_mini_info.xml'),/targetCellWidth="2"/);
assert.match(read(p+'widget_ring_premium_info.xml'),/targetCellWidth="4"/);
assert.match(read(p+'widget_ring_premium_info.xml'),/targetCellHeight="4"/);
assert.match(read(p+'widget_prayer_strip_info.xml'),/targetCellWidth="4"/);
assert.match(read(p+'widget_prayer_strip_info.xml'),/targetCellHeight="2"/);
for(const suffix of ['', '_light']){
  const mini=read(p+'widget_ring_mini'+suffix+'.xml');
  const premium=read(p+'widget_ring_premium'+suffix+'.xml');
  const squared=read(p+'widget_ring_square'+suffix+'.xml');
  assert.match(mini,/widget_ring_mini_art/);
  assert.match(premium,/widget_ring_premium_art/);
  assert.match(squared,/widget_ring_square_art/);
  assert.match(squared,/android:background="@drawable\/widget_bg(_light)?"/);
  assert.match(premium,/widget_ring_premium_cell_0/);
  assert.match(premium,/widget_ring_premium_cell_5/);
  const strip=read(p+'widget_prayer_strip'+suffix+'.xml');
  for(let i=0;i<6;i++){
    element(strip,'widget_strip_cell_'+i);
    element(strip,'widget_strip_label_'+i);
    element(strip,'widget_strip_time_'+i);
    element(premium,'widget_ring_premium_clock_'+i);
  }
  assert.match(strip,/android:layout_height="45dp"/);
  const day=read(p+'widget_prayer_day'+suffix+'.xml');
  for(let i=0;i<6;i++){
    element(day,'widget_day_row_'+i);
    element(day,'widget_day_label_'+i);
    element(day,'widget_day_time_'+i);
  }
  assert.match(day,/android:layout_height="41dp"/);
  const slim=read(p+'widget_slim_prayer'+suffix+'.xml');
  assert.match(slim,/KALAN SÜRE/);
  assert.doesNotMatch(slim,/android:textSize="24sp"/,
    '1×2 width cannot safely render an oversized HH:MM:SS chronometer');
}
assert.match(scheduler,/setChronometerCountDown\(viewId,true\)/);
assert.match(scheduler,/SystemClock\.elapsedRealtime\(\)\+remaining/);
for(const [name,id] of Object.entries(clocks)){
  assert.match(scheduler,new RegExp('R\\.id\\.'+id),
    'Native scheduler must drive '+name+' countdown');
}
for(const token of ['widget_ring_square_root','widget_ring_square_art',
    'installedSquareRing','widget_day_footer','widget_day_countdown'])
  assert.match(scheduler,new RegExp(token));
assert.match(scheduler,/manager\.updateAppWidget\(squareRing,card\)/);
assert.match(scheduler,/nextInCurrentDay\?label\.equals\(next\):i==5/,
  'After Yatsı do not highlight today’s expired İmsak');
assert.match(scheduler,/BRAND_VERSION=4/);
assert.match(pipe,/dirty\[8\]&&installed\[8\]\.length>0/);
assert.match(pipe,/PrayerRingBitmapRenderer\.render\(times,now,224\)/);
assert.match(pipe,/PrayerRingBitmapRenderer\.render\(times,now,432\)/);
const ring=read(p+'PrayerRingBitmapRenderer.java');
assert.match(ring,/size==224\?\.376f:\.346f/);
assert.match(ring,/sector\(canvas,pen,ring,0,boundaries\[0\],COLORS\[5\]/);
assert.doesNotMatch(ring,/fetch\(|HttpURLConnection|WebView/);
console.log('Widget Design 7.0: 9 variants, countdown-first hierarchy in light/dark themes, 4×2 day counter and fixed 2×2 ring validated');
