/**
 * Widget 3.0 cross-layer release gate.
 * This is not a replacement for launcher/power-management device QA.
 * Prevents reintroducing the 72-hour invalidation or silently removing the
 * Android native recovery path during unrelated Expo/UI changes.
 */
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';

const root=resolve(import.meta.dirname,'..');
const read=p=>readFileSync(resolve(root,p),'utf8');
const cache=read('packages/core/src/widgetCalendarCache.ts');
const native=read('apps/mobile/plugins/widget-native/WidgetBoundaryScheduler.java');
const bridge=read('apps/mobile/plugins/widget-native/CamideyizWidgetBridge.java');
const receiver=read('apps/mobile/plugins/widget-native/WidgetBoundaryReceiver.java');
const sync=read('apps/mobile/src/features/widgets/widgetSync.android.ts');
const nativeBridge=read('apps/mobile/src/features/widgets/widgetNativeDiagnostics.android.ts');
const service=read('apps/mobile/src/features/widgets/widgetBackground.ts');
const panel=read('apps/mobile/src/features/widgets/Widget3Diagnostics.tsx');
const companion=read('apps/mobile/src/features/companion/CompanionProvider.tsx');
const screen=read('apps/mobile/src/app/companion.tsx');

assert.match(cache,/WIDGET_CACHE_MAX_AGE_MS=16\*24\*60\*60_000/,
  '16 days of verified published coverage must remain usable offline');
assert.match(native,/MAX_AGE = 16L \* 24 \* 60 \* 60 \* 1000/,
  'Android publisher must not discard still-dated calendars after 72 hours');
assert.match(native,/sourceAt>0 && now-sourceAt<=MAX_AGE/,
  'native refresh must retain a bounded source age');
assert.match(native,/Math\.min\(sourceAt\+MAX_AGE,calendarEndsAt\)/,
  'native scheduler must stop at the published calendar coverage boundary');
assert.match(native,/getAppWidgetIds\(component\(context,NAMES\[0\]\)\)/);
assert.match(native,/getAppWidgetIds\(component\(context,NAMES\[1\]\)\)/);
assert.match(native,/manager\.updateAppWidget\(small,card\)/);
assert.match(native,/manager\.updateAppWidget\(day,card\)/);
assert.match(native,/setAndAllowWhileIdle\(AlarmManager\.RTC_WAKEUP/,
  'native rollover must retain a Doze-aware best-effort alarm');
assert.match(native,/result\.put\("nativeCityId",nativeCityId\)/,
  'native status must identify the stored district for safe recovery');
assert.match(native,/result\.put\("launcherConfirmed",false\)/,
  'app must not claim OS launcher pixel acknowledgement');
assert.match(bridge,/public void refreshNow\(Promise promise\)/,
  'one-tap repair bridge required');
assert.match(receiver,/WidgetBoundaryScheduler\.refresh\(context\.getApplicationContext\(\),"receiver:"\+action\)/);
assert.match(nativeBridge,/before\.nativeCityId!==cityId/,
  'must never recover a different district');
assert.match(sync,/repairPersistedAndroidWidget\(cityId\)/,
  'Android sync must use the guarded native recovery helper');
assert.match(service,/recoverPrayerWidgets\(place\.id\)/,
  'temporary JS/network failure must not erase valid native calendar');
assert.match(panel,/Takvimi eşitle ve çizdir/);
assert.match(panel,/Raporu paylaş/);
assert.match(panel,/Native kayıt ve güncelleme istekleri gerçek ana ekran piksellerinin doğrulanması değildir/);
assert.match(screen,/<Widget3Diagnostics\/>/);
for(const file of ['widget_next_prayer_info.xml','widget_prayer_day_info.xml']){
  const source=read('apps/mobile/plugins/widget-native/'+file);
  assert.match(source,/android:updatePeriodMillis="1800000"/,
    'Android widget host periodic fallback must remain enabled: '+file);
}

// Widget 3.1: provider loading must never mean calendar deletion.
// Only an explicit district selection may invalidate a previous district.
assert.match(native,/public static synchronized JSONObject selectDistrict\(/);
assert.match(native,/empty calendar rejected: use selectDistrict instead/);
assert.match(native,/lastTransferError/);
assert.match(native,/activeCityId/);
assert.match(native,/calendar district differs from selected district/);
assert.match(bridge,/public void selectDistrict\(int cityId, Promise promise\)/);
assert.match(bridge,/public void reportTransfer\(int cityId,String stage,String detail,Promise promise\)/);
assert.match(nativeBridge,/selectAndroidWidgetDistrict\(cityId:number\)/);
assert.match(nativeBridge,/if\(!days\.length\|\|cityId<=0\)/);
assert.doesNotMatch(nativeBridge,/publishCalendar\(''\)/);
assert.match(sync,/if\(!days\.length\|\|cityId<=0\)return/);
assert.match(service,/await prepareWidgetDistrict\(place\?\.id\?\?0\)/);
assert.match(service,/recordWidgetTransferIssue\(place\.id,'waiting'/);
assert.match(service,/if\(selected\.length>0\)\{/,
  'Only validated days may reach native calendar publisher');
assert.match(service,/result=recovered\?\?\{available:true,updated:false,detail:reason\}/,
  'Waiting source must never report a freshly delivered native calendar');
assert.match(panel,/lastTransferError/);
assert.match(panel,/source\.failureReason/);
assert.match(panel,/companion\.widget\.detail/);
assert.match(panel,/registrationError/);
assert.match(service,/export async function fetchAndPublishVerifiedWidgetCalendar\(/,
  'manual recovery must refetch selected district directly when React state is empty');
assert.match(service,/await getMirrorPrayerTriplet\(place,today\)/);
assert.match(service,/parseWidgetCalendarCache\(cache,now,place\.id\)/);
assert.match(service,/current\.id!==place\.id\|\|current\.source!==source/,
  'after network fetch, recheck district before publishing');
assert.match(companion,/fetchAndPublishVerifiedWidgetCalendar\(place,selectedSource\)/,
  'refresh button must call the dedicated verified publisher fallback');
assert.match(companion,/if\(!ready\|\|!source\.place\)return/,
  'startup with GPS still resolving must not erase native storage');
assert.match(panel,/if\(!result\.updated\)setError\(result\.detail\)/,
  'manual repair must not claim success before native publish');
console.log('Widget 3.1: no blank cache writes, persistent diagnostics, verified offline horizon, native rollover, same-city recovery, 30m host fallback, diagnostic UX');
