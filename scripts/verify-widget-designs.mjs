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
console.log('Widget Design 4.0: four native variants, 1x1 metadata, two system countdowns, theme bridge and validated timeline verified');
