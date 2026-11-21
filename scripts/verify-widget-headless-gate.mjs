/**
 * Pure runnable Widget Engine 4.0 policy tests (no Android environment).
 * Fail closed on stale source, missing upcoming alarm, wrong city and
 * incomplete published coverage; never trust "persisted" alone.
 */
import assert from 'node:assert/strict';
import {
  shouldSkipWidgetHeadlessRefresh,
  HEADLESS_RECHECK_MS,HEADLESS_COVERAGE_MS,HEADLESS_MAX_SOURCE_AGE_MS,
} from '../apps/mobile/src/features/widgets/widgetHealthPolicy.ts';

const now=Date.parse('2026-11-21T08:00:00+03:00');
const good={
  supported:true,persisted:true,hasTimeline:true,lastReady:true,
  nativeCityId:9545,activeCityId:9545,lastError:'',lastTransferError:'',
  calendarSourceAt:now-10*60_000,lastSyncAt:now-15*60_000,
  calendarEndsAt:now+2*86_400_000,nextAlarmAt:now+2*60_000,
  installedNext:1,installedDay:0,installedCompact:1,installedFocus:0,
  installedStrip:0,installedMiniRing:0,installedPremiumRing:1,installedSlim:0,
};
assert.equal(shouldSkipWidgetHeadlessRefresh(good,now),true);
for(const patch of [
  {supported:false},{persisted:false},{hasTimeline:false},{lastReady:false},
  {nativeCityId:9541},{activeCityId:0},{lastError:'disk'},
  {lastTransferError:'district mismatch'},
  {calendarSourceAt:now-HEADLESS_MAX_SOURCE_AGE_MS-1},
  {calendarSourceAt:now+60_001},
  {lastSyncAt:now-HEADLESS_RECHECK_MS},
  {lastSyncAt:now+60_001},
  {calendarEndsAt:now+HEADLESS_COVERAGE_MS},
  {nextAlarmAt:now},{nextAlarmAt:now+4*86_400_000},
  {installedNext:0,installedCompact:0,installedPremiumRing:0},
  {installedNext:-1},{installedCompact:0.5},
]){
  assert.equal(shouldSkipWidgetHeadlessRefresh({...good,...patch},now),false,
    'Invalid native health must not skip headless refresh: '+JSON.stringify(patch));
}
assert.equal(shouldSkipWidgetHeadlessRefresh(null,now),false);
assert.equal(shouldSkipWidgetHeadlessRefresh([],now),false);
assert.equal(shouldSkipWidgetHeadlessRefresh({},now),false);
assert.equal(shouldSkipWidgetHeadlessRefresh(good,NaN),false);
assert.equal(shouldSkipWidgetHeadlessRefresh(good,Infinity),false);
const boundary={...good,lastSyncAt:now-HEADLESS_RECHECK_MS+1,
  calendarEndsAt:now+HEADLESS_COVERAGE_MS+1,
  calendarSourceAt:now-HEADLESS_MAX_SOURCE_AGE_MS};
assert.equal(shouldSkipWidgetHeadlessRefresh(boundary,now),true);
console.log('Widget Engine 4.0 headless policy: valid native cache bypasses heavy JS; 22 wrong-city, stale, missing-alarm and damaged-cache cases fail closed');
