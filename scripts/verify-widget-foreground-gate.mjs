import assert from 'node:assert/strict';
import {
  widgetNeedsForegroundPublish,FOREGROUND_REPUBLISH_INTERVAL_MS,
} from '../apps/mobile/src/features/widgets/widgetForegroundGate.ts';

const NOW=1_795_063_000_000;
const current={
  supported:true,persisted:true,hasTimeline:true,lastReady:true,
  nativeCityId:9545,activeCityId:9545,
  lastSyncAt:NOW-45*60_000,calendarEndsAt:NOW+14*24*60*60_000,
  calendarSourceAt:NOW-60*60_000,
  lastError:'',lastTransferError:'',
  lastAppliedAt:NOW-45*60_000,nextAlarmAt:NOW+60*60_000,
  installedNext:1,installedDay:1,
};
assert.equal(widgetNeedsForegroundPublish(current,9545,NOW),false,
  'device report: correct Pendik native timeline must skip expensive startup sync');
assert.equal(widgetNeedsForegroundPublish(null,9545,NOW),true,
  'missing native status must still allow initial publication');
assert.equal(widgetNeedsForegroundPublish({...current,hasTimeline:false},9545,NOW),true);
assert.equal(widgetNeedsForegroundPublish({...current,persisted:false},9545,NOW),true);
assert.equal(widgetNeedsForegroundPublish({...current,lastReady:false},9545,NOW),true);
assert.equal(widgetNeedsForegroundPublish({...current,activeCityId:9551},9545,NOW),true);
assert.equal(widgetNeedsForegroundPublish({...current,nativeCityId:9551},9545,NOW),true);
assert.equal(widgetNeedsForegroundPublish({...current,lastError:'broken'},9545,NOW),true);
assert.equal(widgetNeedsForegroundPublish({...current,lastTransferError:'broken'},9545,NOW),true);
assert.equal(widgetNeedsForegroundPublish({...current,calendarEndsAt:NOW+20*60_000},9545,NOW),true);
assert.equal(widgetNeedsForegroundPublish({...current,calendarSourceAt:NOW+120_000},9545,NOW),true);
assert.equal(widgetNeedsForegroundPublish({...current,lastSyncAt:NOW+120_000},9545,NOW),true);
assert.equal(widgetNeedsForegroundPublish({...current,lastSyncAt:NOW-FOREGROUND_REPUBLISH_INTERVAL_MS+1},9545,NOW),false);
assert.equal(widgetNeedsForegroundPublish({...current,lastSyncAt:NOW-FOREGROUND_REPUBLISH_INTERVAL_MS},9545,NOW),true);
assert.equal(widgetNeedsForegroundPublish(current,0,NOW),false,
  'GPS unresolved must not clear existing district');
console.log('Widget foreground health gate: healthy installed Pendik widgets skip startup write; old/wrong/missing data republished safely');
