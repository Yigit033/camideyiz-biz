/**
 * Static native-widget parity gate: real launcher layouts, bridge, time source
 * and system-driven countdown. This is not a Gradle build or device screenshot.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const read=p=>readFileSync(resolve(import.meta.dirname,'..',p),'utf8');
const p='apps/mobile/plugins/widget-native/';
const plugin=read('apps/mobile/plugins/withWidgetBoundaryBridge.js');
const scheduler=read(p+'WidgetBoundaryScheduler.java');
const bridge=read(p+'CamideyizWidgetBridge.java');
const appearance=read('apps/mobile/src/theme/ThemeProvider.tsx');
const variants=['widget_compact_prayer','widget_next_prayer','widget_prayer_day',
  'widget_prayer_focus','widget_prayer_strip','widget_ring_mini','widget_ring_premium'];
for(const base of variants){
  const info=read(p+base+'_info.xml');
  assert.match(info,/updatePeriodMillis="1800000"/);
  for(const suffix of ['', '_light']){
    const layout=read(p+base+suffix+'.xml');
    assert.match(layout,/xmlns:android=/);
    assert.match(layout,/widget_bg/);
    assert.doesNotMatch(layout,/Pendik|17:51|06:17/,
      'native initialLayout may never display invented prayer time/location samples');
    assert.doesNotMatch(layout,/<View\b/,
      'android.view.View is not an allowed RemoteViews XML child; use TextView dividers');
    assert.ok(base==='widget_ring_mini'||
      layout.includes('Camideyiz Biz')||layout.includes('widget_compact_mark'),
      'the 2×2 ring intentionally reserves center for the countdown');
    assert.ok(plugin.includes("'"+base+suffix+".xml'"),base+suffix+' missing from CNG');
  }
  assert.ok(plugin.includes("'"+base+"_info.xml'"),base+' missing from manifest');
}
assert.match(read(p+'widget_compact_prayer_info.xml'),/targetCellWidth="1"/);
assert.match(read(p+'widget_compact_prayer_info.xml'),/targetCellHeight="1"/);
assert.match(read(p+'widget_next_prayer_info.xml'),/targetCellWidth="2"/);
assert.match(read(p+'widget_prayer_focus_info.xml'),/targetCellWidth="4"/);
assert.match(read(p+'widget_prayer_strip_info.xml'),/targetCellHeight="2"/);
assert.match(read(p+'widget_prayer_strip_info.xml'),/resizeMode="horizontal\|vertical"/);
for(const layout of ['widget_compact_prayer','widget_next_prayer',
  'widget_prayer_focus','widget_prayer_strip','widget_ring_mini',
  'widget_ring_premium']){
  assert.match(read(p+layout+'.xml'),/<Chronometer\b/,
    'live counter must be Android Chronometer not text refreshed by JS');
}
assert.match(scheduler,/setChronometerCountDown\(viewId,true\)/);
assert.match(scheduler,/SystemClock\.elapsedRealtime\(\)\+remaining/);
assert.match(scheduler,/nextAt-now/);
assert.match(scheduler,/installedCompact/);
assert.match(scheduler,/installedFocus/);
assert.match(scheduler,/installedStrip/);
assert.match(scheduler,/installedMiniRing/);
assert.match(scheduler,/installedPremiumRing/);
assert.match(read(p+'widget_ring_mini_info.xml'),/targetCellWidth="2"/);
assert.match(read(p+'widget_ring_premium_info.xml'),/targetCellWidth="4"/);
assert.match(read(p+'widget_ring_premium_info.xml'),/targetCellHeight="4"/);
for(const base of variants){
  assert.match(read(p+base+'_info.xml'),/widgetCategory="home_screen\|keyguard"/,
    'all widgets must opt into compatible keyguard hosts');
}
const nativeRing=read(p+'PrayerRingBitmapRenderer.java');
assert.match(nativeRing,/Bitmap\.createBitmap\(size,size,Bitmap\.Config\.ARGB_8888\)/);
assert.match(nativeRing,/new LruCache<String,Bitmap>\(2\*1024\*1024\)/);
assert.match(nativeRing,/sector\(canvas,pen,arc,0,boundaries\[0\],COLORS\[5\]/);
assert.match(nativeRing,/for\(int i=0;i<5;i\+\+\)/);
assert.match(nativeRing,/if\(size==432\)/);
assert.match(nativeRing,/canvas\.drawText\(clock,px,py\+size\*\.012f,labelPaint\)/);
assert.match(nativeRing,/boundaries\[i\]\*\.25d/);
assert.match(nativeRing,/sector\(canvas,pen,arc,boundaries\[5\],1440,COLORS\[5\]/);
assert.doesNotMatch(nativeRing,/fetch\(|HttpURLConnection|setInterval|WebView/);
assert.match(scheduler,/PrayerRingBitmapRenderer\.render\(times,now,light,224\)/);
assert.match(scheduler,/PrayerRingBitmapRenderer\.render\(times,now,light,432\)/);
assert.match(scheduler,/manager\.updateAppWidget\(miniRing,card\)/);
assert.match(scheduler,/manager\.updateAppWidget\(premiumRing,card\)/);
assert.match(scheduler,/nextInCurrentDay && label\.equals\(next\)/,
  'never highlight yesterday Imask while counting to tomorrow');
assert.match(scheduler,/R\.layout\.widget_compact_prayer_light/);
assert.match(scheduler,/R\.layout\.widget_prayer_focus_light/);
/** Four physical launcher columns contain six equal-width prayer slots.
 * The reference has a distinct blue top panel, a high-contrast selected tile,
 * and a bright footer with the live countdown. Verify both theme layouts.
 */
for(const suffix of ['', '_light']){
  const strip=read(p+'widget_prayer_strip'+suffix+'.xml');
  const theme=suffix?'light':'dark';
  assert.match(strip,new RegExp('@drawable/widget_strip_header_'+theme));
  assert.match(strip,new RegExp('@drawable/widget_strip_footer_'+theme));
  assert.match(strip,/android:layout_height="0dp"\s+android:layout_weight="1"/,
    'six prayers should get the flexible upper band in a 4x2 tile');
  for(let i=0;i<6;i++){
    assert.match(strip,new RegExp('android:id="@\\+id/widget_strip_cell_'+i+'"'));
    assert.match(strip,new RegExp('android:id="@\\+id/widget_strip_label_'+i+'"'));
    assert.match(strip,new RegExp('android:id="@\\+id/widget_strip_time_'+i+'"'));
  }
  assert.equal((strip.match(/android:layout_weight="1"/g)||[]).length,8,
    'one weighted header, six equal prayer cells and one flex footer content region');
  assert.match(strip,/android:id="@\+id\/widget_strip_next"/);
  assert.match(strip,/<Chronometer[\s\S]*?widget_strip_countdown/);
  assert.match(strip,/@drawable\/widget_brand_symbol/);
  assert.doesNotMatch(strip,/Kerahat vaktine kalan/,
    'kerahat estimate is user-configurable and must not be shown as official');
}
for(const theme of ['dark','light']){
  for(const part of ['header','footer','selected']){
    const resource='widget_strip_'+part+'_'+theme+'.xml';
    assert.ok(plugin.includes("'"+resource+"'"),resource+' not copied by CNG');
    assert.match(read(p+resource),/<shape /);
  }
}
assert.match(scheduler,/R\.drawable\.widget_strip_selected_dark/);
assert.match(scheduler,/R\.drawable\.widget_strip_selected_light/);
assert.match(scheduler,/selected\?selectedInk:ordinary/);
assert.match(scheduler,/nextInCurrentDay && label\.equals\(next\)/);

assert.match(scheduler,/times\.getJSONObject\(\(nextIndex\+5\)%6\)/);
assert.match(bridge,/void setAppearance\(String mode,String resolved,Promise promise\)/);
assert.match(appearance,/native\.setAppearance\(mode,resolved\)/);
assert.match(plugin,/drawable-nodpi/);
assert.match(plugin,/camideyiz-original-symbol\.png/);
assert.match(plugin,/widget_brand_symbol\.png/);
for(const base of variants.filter(x=>x!=='widget_ring_mini')){
  const xml=read(p+base+'.xml');
  assert.match(xml,/@drawable\/widget_brand_symbol/,
    'branded widgets must use exact supplied 3D mark; mini ring favors readability');
}
const tokens=read('apps/mobile/src/theme/tokens.ts');
assert.match(tokens,/#071725/);
const widgetBackground=read(p+'widget_bg.xml');
assert.match(widgetBackground,/#071725/);
assert.match(widgetBackground,/#102B40/);
assert.doesNotMatch(scheduler,/getMirrorPrayerTriplet|fetch\(|new Thread\(/,
 'native layout must never load a network/JS prayer engine');
console.log('Widget Design 6.0: seven native variants, six-sector 2x2/4x4 rings, seven keyguard declarations, 3D brand and native countdown contracts verified');
