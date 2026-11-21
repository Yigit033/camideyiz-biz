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
  'widget_prayer_focus','widget_prayer_strip','widget_ring_mini','widget_ring_premium',
  'widget_slim_prayer'];
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
    assert.match(layout,/@drawable\/widget_brand_lockup/,
      'all eight widget families must show the supplied complete lockup');
    assert.doesNotMatch(layout,/android:text="Camideyiz Biz"/,
      'separate brand TextView duplicates the lettering inside supplied logo');
    assert.doesNotMatch(layout,/@drawable\/widget_brand_symbol/,
      'old standalone brand symbol is not permitted on widget faces');
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
  'widget_ring_premium','widget_slim_prayer']){
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
assert.match(scheduler,/installedSlim/);
assert.match(read(p+'widget_slim_prayer_info.xml'),/targetCellWidth="1"/);
assert.match(read(p+'widget_slim_prayer_info.xml'),/targetCellHeight="2"/);
assert.match(read(p+'widget_compact_prayer.xml'),/android:textSize="14sp"/);
assert.doesNotMatch(read(p+'widget_compact_prayer.xml'),/android:text="Kalan "/,
  '1×1 must never horizontally overflow with both label and HH:MM:SS ticker');
for(const name of ['widget_next_prayer','widget_prayer_focus']){
  for(const suffix of ['', '_light']){
    assert.doesNotMatch(read(p+name+suffix+'.xml'),/android:text="☾"/,
      'right-edge decorative crescent has no meaning and must be removed');
  }
}
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
assert.match(nativeRing,/sector\(canvas,pen,ring,0,boundaries\[0\],COLORS\[5\]/);
assert.match(nativeRing,/for\(int i=0;i<5;i\+\+\)/);
assert.match(nativeRing,/sector\(canvas,pen,ring,boundaries\[5\],1440,COLORS\[5\]/);
assert.match(nativeRing,/pen\.setStrokeWidth\(size\*\.045f\)/);
assert.match(nativeRing,/Paint\.Cap\.ROUND/);
assert.doesNotMatch(nativeRing,/canvas\.drawText\(clock,px,py|canvas\.drawCircle\(cx,cy/,
  'do not paint colliding labels or a static position marker onto the ring');
assert.doesNotMatch(nativeRing,/fetch\(|HttpURLConnection|setInterval|WebView/);
const pipeline=read(p+'WidgetRenderPipeline.java');
assert.match(pipeline,/PrayerRingBitmapRenderer\.render\(times,now,false,224\)/);
assert.match(pipeline,/PrayerRingBitmapRenderer\.render\(times,now,false,432\)/);
assert.match(scheduler,/R\.id\.widget_ring_premium_label_0/);
assert.match(scheduler,/R\.id\.widget_ring_premium_clock_5/);
assert.match(scheduler,/manager\.updateAppWidget\(slim,card\)/);
assert.match(scheduler,/manager\.updateAppWidget\(miniRing,card\)/);
assert.match(scheduler,/manager\.updateAppWidget\(premiumRing,card\)/);
assert.match(scheduler,/nextInCurrentDay && label\.equals\(next\)/,
  'never highlight yesterday Imask while counting to tomorrow');
assert.match(scheduler,/R\.layout\.widget_compact_prayer_light/);
assert.match(scheduler,/R\.layout\.widget_prayer_focus_light/);
/** Six prayer cells share a physical 4×2 grid; compact header and footer
 * are always visible without an empty half-card or faux white lower panel.
 */
for(const suffix of ['', '_light']){
  const strip=read(p+'widget_prayer_strip'+suffix+'.xml');
  assert.match(strip,/android:layout_height="35dp"/);
  assert.match(strip,/android:id="@\+id\/widget_strip_city"/);
  assert.match(strip,/android:layout_height="42dp"/);
  assert.match(strip,/android:layout_height="0dp"\s+android:layout_weight="1"/);
  assert.match(strip,new RegExp('@drawable/widget_chip_'+(suffix?'light':'dark')));
  for(let i=0;i<6;i++){
    assert.match(strip,new RegExp('android:id="@\\+id/widget_strip_cell_'+i+'"'));
    assert.match(strip,new RegExp('android:id="@\\+id/widget_strip_label_'+i+'"'));
    assert.match(strip,new RegExp('android:id="@\\+id/widget_strip_time_'+i+'"'));
  }
  assert.match(strip,/android:id="@\+id\/widget_strip_next"/);
  assert.match(strip,/<Chronometer[\s\S]*?widget_strip_countdown/);
  assert.match(strip,/@drawable\/widget_brand_lockup/);
  assert.doesNotMatch(strip,/widget_strip_header_|widget_strip_footer_|Kerahat vaktine kalan/,
    'old empty-panel composition or unverified kerahat must not return');
}
for(const suffix of ['', '_light']){
  const slim=read(p+'widget_slim_prayer'+suffix+'.xml');
  assert.match(slim,/android:text="Kalan"/);
  assert.match(slim,/widget_slim_time"[\s\S]*?android:textSize="16sp"/);
  assert.match(slim,/widget_slim_countdown[\s\S]*?android:textSize="11sp"/);
  assert.doesNotMatch(slim,/KALAN SÜRE|widget_slim_city|android:textSize="21sp"|android:textSize="24sp"/,
    'narrow 1×2 clock or countdown must not be abbreviated or cut off');
}
assert.match(scheduler,/R\.id\.widget_strip_city/);
assert.match(scheduler,/nextInCurrentDay\?label\.equals\(next\):i==5/);
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
assert.match(plugin,/widget_brand_lockup\.png/);
const originalLockup=readFileSync(resolve(import.meta.dirname,'..',
  'apps/mobile/assets/widget-brand-lockup.png'));
assert.equal(originalLockup.subarray(1,4).toString('ascii'),'PNG');
assert.equal(originalLockup.readUInt32BE(16),128);
assert.equal(originalLockup.readUInt32BE(20),128);
for(const base of variants.filter(x=>x!=='widget_ring_mini')){
  const xml=read(p+base+'.xml');
  assert.match(xml,/@drawable\/widget_brand_lockup/,
    'branded widgets must use the user-supplied full mark with lettering embedded');
}
const tokens=read('apps/mobile/src/theme/tokens.ts');
assert.match(tokens,/#071725/);
const widgetBackground=read(p+'widget_bg.xml');
assert.match(widgetBackground,/#071725/);
assert.match(widgetBackground,/#102B40/);
assert.doesNotMatch(scheduler,/getMirrorPrayerTriplet|fetch\(|new Thread\(/,
 'native layout must never load a network/JS prayer engine');
// The ring must stay visually legible; its label/clock footer cannot be
// painted over the circular art and no light-mode white canvas is permitted.
for(const suffix of ['', '_light']){
  const mini=read(p+'widget_ring_mini'+suffix+'.xml');
  const premium=read(p+'widget_ring_premium'+suffix+'.xml');
  assert.match(mini,/android:background="@drawable\/widget_bg"/);
  assert.match(premium,/android:background="@drawable\/widget_bg"/);
  assert.match(mini,/widget_ring_mini_art/);
  assert.match(mini,/widget_ring_mini_countdown/);
  assert.match(premium,/widget_ring_premium_cell_0/);
  assert.match(premium,/widget_ring_premium_cell_5/);
  assert.match(premium,/widget_brand_lockup/);
}
console.log('Widget Design 6.3: eight widgets use the user-supplied single-image brand, intact six-clock layout, and independent bounded ring renderer');
