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
    // Theme-matched transparent mark: glowing cyan on navy, deep azure on ivory.
    assert.match(xml,suffix?/@drawable\/widget_brand_mark_light"/:/@drawable\/widget_brand_mark_dark"/);
    assert.doesNotMatch(xml,suffix?/widget_brand_mark_dark/:/widget_brand_mark_light/);
    assert.doesNotMatch(xml,/widget_brand_lockup/,'the opaque square badge logo is retired');
    // singleLine makes TextView autosize treat the width as unbounded
    // (horizontal scrolling), which ellipsized countdowns as "7:29:…".
    assert.doesNotMatch(xml,/android:singleLine=/,'use maxLines="1": '+file);
    assert.doesNotMatch(xml,/<View\b|android:text="Camideyiz Biz"|@drawable\/widget_brand_symbol/,
      'Native RemoteViews must use supported tags and a SINGLE supplied logo: '+file);
    assert.doesNotMatch(xml,/Pendik|Tuzla|12:54|28:40/,
      'Initial widget layouts must not ship fabricated clocks/locations');
    assert.match(element(xml,clocks[kind]),/^<Chronometer\b/);
    assert.match(element(xml,clocks[kind]),/android:maxLines="1"/);
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
  // Footer = 40dp floor + weighted growth (tall cells enlarge the countdown).
  assert.match(element(strip,'widget_strip_remaining_row'),
    /android:layout_height="40dp" android:layout_weight="0\.25"/);
  const day=read(p+'widget_prayer_day'+suffix+'.xml');
  for(let i=0;i<6;i++){
    element(day,'widget_day_row_'+i);
    element(day,'widget_day_label_'+i);
    element(day,'widget_day_time_'+i);
  }
  assert.match(day,/android:layout_height="38dp" android:layout_weight="0\.25"/);
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
assert.match(scheduler,/BRAND_VERSION=5;/);
assert.match(pipe,/dirty\[8\]&&installed\[8\]\.length>0/);
assert.match(pipe,/PrayerRingBitmapRenderer\.render\(times,now,224\)/);
assert.match(pipe,/PrayerRingBitmapRenderer\.render\(times,now,432\)/);
const ring=read(p+'PrayerRingBitmapRenderer.java');
assert.match(ring,/size==224\?\.43f:\.44f/);
// Ring + outer rim (r+.043) and active halo must stay inside the bitmap.
for(const r of [.43,.44])assert.ok(r+.043<.5&&r+.0345<.5,'ring exceeds bitmap at r='+r);

// Widget Design 8.0 — adaptive space: content scales with the launcher cell.
for(const kind of variants){
  for(const suffix of ['','_light']){
    const xml=read(p+kind+suffix+'.xml');
    // Every countdown autosizes into a definite box: a wrap_content
    // Chronometer was what ellipsized "7:58:…" in the 1×2 widget.
    const hero=element(xml,clocks[kind]);
    assert.match(hero,/android:autoSizeTextType="uniform"/,kind+suffix+' countdown must autosize');
    assert.match(hero,/android:layout_width="(match_parent|0dp)"/,kind+suffix+' countdown needs a definite width');
    assert.match(hero,/android:layout_height="(match_parent|0dp)"/,kind+suffix+' countdown needs a definite height');
    const max=Number(hero.match(/autoSizeMaxTextSize="(\d+)sp"/)[1]);
    assert.ok(max>font(xml,clocks[kind]),kind+suffix+' countdown must be able to grow');
    // Countdown-first must hold at EVERY size, not only at default sp.
    const secondMax=Number(element(xml,secondary[kind])
      .match(/autoSizeMaxTextSize="(\d+)sp"/)?.[1]??font(xml,secondary[kind]));
    assert.ok(max>secondMax,kind+suffix+' secondary text may outgrow the countdown ('+
      secondMax+' vs '+max+')');
    // Every autosized view has a definite box and a single line.
    for(const tag of xml.match(/<(TextView|Chronometer)\b[^<>]*autoSizeTextType[^<>]*>/g)??[]){
      assert.doesNotMatch(tag,/android:layout_(width|height)="wrap_content"/,
        'autosize needs fixed/weighted bounds: '+kind+suffix);
      assert.match(tag,/android:maxLines="1"/);
      assert.doesNotMatch(tag,/android:ellipsize=/,'autosized text must shrink, not ellipsize');
    }
  }
}
// 1×2: "KALAN SÜRE" and HH:MM:SS shrink to the narrow column instead of "…".
const slimXml=read(p+'widget_slim_prayer.xml');
assert.match(slimXml,/android:text="KALAN SÜRE"[^>]*autoSizeTextType="uniform"/);
// Ring centre text sits in a box proportional to the ring (weighted spacers),
// so it scales with the ring instead of floating at a fixed sp size.
for(const name of ['widget_ring_mini','widget_ring_square','widget_ring_premium']){
  const xml=read(p+name+'.xml');
  assert.match(xml,/<FrameLayout[^>]*android:layout_weight="1"/);
  assert.ok((xml.match(/android:layout_weight="0\.\d+" android:text=""\/>/g)??[]).length>=4,
    name+' needs proportional horizontal and vertical spacers around the centre text');
}
assert.match(ring,/sector\(canvas,pen,ring,0,boundaries\[0\],COLORS\[5\]/);
assert.doesNotMatch(ring,/fetch\(|HttpURLConnection|WebView/);
console.log('Widget Design 8.0: 9 variants, countdown-first hierarchy, autosized content that fills the launcher cell, ring-proportional centre text and light/dark parity validated');
