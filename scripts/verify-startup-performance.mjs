/**
 * Cold-start performance regression gate, built from the real device report.
 * No fabricated performance thresholds: actual cold-start wall time must
 * still be measured on a physical phone in release mode.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const read=p=>readFileSync(resolve(import.meta.dirname,'..',p),'utf8');
const source=read('apps/mobile/src/features/prayer/usePrayerSource.ts');
const home=read('apps/mobile/src/app/(tabs)/index.tsx');
const wisdom=read('apps/mobile/src/features/wisdom/DailyWisdomSection.tsx');
const audio=read('apps/mobile/src/features/adhan/AdhanPlaybackProvider.tsx');
const audioCard=read('apps/mobile/src/features/adhan/AdhanExperience.tsx');
const companion=read('apps/mobile/src/features/companion/CompanionProvider.tsx');
const layout=read('apps/mobile/src/app/_layout.tsx');
const task=read('apps/mobile/src/features/widgets/widgetTaskRegistration.ts');
const widgets=read('apps/mobile/src/features/widgets/widgetBackground.ts');

assert.match(source,/validateCachedMirrorTriplet\(data,place\.id,dateISO,/,
  'previously published hours must remain visible during revalidation');
assert.match(source,/Date\.now\(\),MIRROR_OFFLINE_CACHE_MS\)/);
assert.match(source,/setData\(olderVerified\);\s*setStatus\('mirror-cached'\)/,
  '24h offline-validated cache must paint BEFORE network fetch');
assert.match(source,/getMirrorPrayerTriplet\(place,dateISO\)/,
  'live provider must still revalidate published hours');
assert.match(source,/data\.city\.id===place\.id&&data\.dateISO===dateISO/,
  'a previous district/date must never leak during warm revalidation');
assert.match(home,/const Pill=memo\(function Pill/);
assert.match(home,/for\(let i=0;i<12;i\+\+\)/,
  'contrast calculation may not run 1000 iteration loops on cold start');
assert.doesNotMatch(home,/for\(let i=1;i<=1000;i\+\+\)/);
assert.match(wisdom,/DailyWisdomSection=memo\(function/);
assert.match(audioCard,/AdhanExperience=memo\(function/);
assert.match(audio,/useAudioPlayer\(null,\{updateInterval:1000\}\)/,
  '3 MB offline audio must not start decoding before first paint');
assert.match(audio,/PRELOAD_AFTER_PAINT_MS=700/);
assert.match(audio,/setStarting\(true\)/,
  'first press must show immediate feedback while the player loads');
assert.match(audio,/if\(!starting\|\|!modeReady\|\|!loaded\)return/,
  'first press must queue until both native media readiness and session readiness');
assert.match(audio,/LOAD_TIMEOUT_MS=15_000/,
  'unavailable audio may not leave the UI spinner indefinitely');
assert.match(audio,/setError\('Ezan yüklenmesi gecikti/,
  'audio setup failure must be shown instead of swallowed');
assert.match(audioCard,/starting\?'Ezan hazırlanıyor/);
assert.match(layout,/import '@\/features\/widgets\/widgetTaskRegistration'/);
assert.doesNotMatch(layout,/import '@\/features\/widgets\/widgetBackground'/,
  'global app must not eagerly load remote calendar and notification maintenance');
assert.match(task,/TaskManager\.defineTask\(WIDGET_BACKGROUND_TASK,async\(\)=>/);
assert.match(task,/await import\('\.\/widgetBackground'\)/,
  'headless task executor must import heavier backend only on execution');
assert.doesNotMatch(widgets,/TaskManager\.defineTask\(/,
  'two task registrations can corrupt headless scheduling');
assert.match(companion,/const loadWidgetEngine=\(\)=>import\('@\/features\/widgets\/widgetBackground'\)/);
assert.match(companion,/setTimeout\(\(\)=>\{[\s\S]*?setMaintenanceReady\(true\);[\s\S]*?\},1600\)/,
  'initial native maintenance must yield first paint');
assert.match(companion,/if\(!ready\|\|!maintenanceReady\|\|!source\.place\)return/);
assert.match(companion,/lastWidgetFingerprint\.current===fingerprint/,
  'same calendar must not be republished on every AppState/status change');
assert.match(companion,/if\(!ready\|\|!maintenanceReady\)return;/,
  'notification scheduling must not compete with first interactive paint');
console.log('Startup QA: stale-while-revalidate verified hours, lazy widget engine, deduped maintenance, responsive queued offline adhan and render memoization');
