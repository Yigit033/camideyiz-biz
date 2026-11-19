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
  'widget_prayer_focus','widget_prayer_strip'];
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
    assert.ok(layout.includes('Camideyiz Biz')||layout.includes('widget_compact_mark'));
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
  'widget_prayer_focus','widget_prayer_strip']){
  assert.match(read(p+layout+'.xml'),/<Chronometer /,
    'live counter must be Android Chronometer not text refreshed by JS');
}
assert.match(scheduler,/setChronometerCountDown\(viewId,true\)/);
assert.match(scheduler,/SystemClock\.elapsedRealtime\(\)\+remaining/);
assert.match(scheduler,/nextAt-now/);
assert.match(scheduler,/installedCompact/);
assert.match(scheduler,/installedFocus/);
assert.match(scheduler,/installedStrip/);
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
  assert.equal((strip.match(/android:layout_weight="1"/g)||[]).length,7,
    'six equal prayer cells plus one flex footer content region');
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
for(const base of variants){
  const xml=read(p+base+'.xml');
  assert.match(xml,/@drawable\/widget_brand_symbol/,
    'all native widgets must use exact supplied 3D brand asset');
}
const tokens=read('apps/mobile/src/theme/tokens.ts');
assert.match(tokens,/#071725/);
const widgetBackground=read(p+'widget_bg.xml');
assert.match(widgetBackground,/#071725/);
assert.match(widgetBackground,/#102B40/);
assert.doesNotMatch(scheduler,/getMirrorPrayerTriplet|fetch\(|new Thread\(/,
 'native layout must never load a network/JS prayer engine');
console.log('Widget Design 5.1: five native variants, 4-cell six-prayer strip, premium header/footer, 3D brand, native countdown and theme regression verified');
