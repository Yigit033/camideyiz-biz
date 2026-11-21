import {NativeModules} from 'react-native';
import {
  buildPrayerWidgetTimeline,type PrayerSchedule,
} from '@camideyiz/core';
import {toWidgetProps} from './widgetSyncShared';

type NativeBridge={
  publishCalendar:(json:string)=>Promise<string>;
  getStatus:()=>Promise<string>;
  refreshNow:()=>Promise<string>;
  selectDistrict:(cityId:number)=>Promise<string>;
  reportTransfer:(cityId:number,stage:'waiting'|'failed',detail:string)=>Promise<string>;
};

export type AndroidWidgetNativeStatus={
  supported:boolean;installedNext:number;installedDay:number;
  installedCompact?:number;installedFocus?:number;installedStrip?:number;
  installedMiniRing?:number;installedPremiumRing?:number;installedSlim?:number;widgetTheme?:string;
  lastAppliedAt:number;nextAlarmAt:number;lastSyncAt:number;
  lastError:string;lastNextName:string;lastNextTime:string;
  lastCity:string;lastDateISO:string;lastReady:boolean;
  persisted:boolean;hasTimeline:boolean;launcherConfirmed:false;
  nativeCityId:number;activeCityId:number;state:string;
  lastTransferAttemptAt:number;lastTransferStage:string;
  lastTransferDetail:string;lastTransferError:string;
  lastAttemptAt:number;lastRefreshReason:string;lastHostDispatchAt:number;
  lastInstanceCount:number;calendarSourceAt:number;calendarEndsAt:number;
  sourceAgeHours:number;osRecoveryMinutes:number;
  engineVersion?:number;
  nativeQueueWaitMs?:number;nativeBridgeQueueWaitMs?:number;
  nativeBatchMs?:number;nativeMaxBatchMs?:number;
  nativeLastBatchSize?:number;nativeCoalescedEvents?:number;
  nativeRefreshBatches?:number;nativeBridgeCalls?:number;
  nativeRefreshMs?:number;nativeCommitMs?:number;nativeRenderMs?:number;
  nativeAlarmMs?:number;nativeSkippedRenders?:number;nativeRenderedBatches?:number;
  nativeRingBitmapMs?:number;nativeRingMaxBitmapMs?:number;
  nativeRenderQueueWaitMs?:number;nativeDispatchQueueWaitMs?:number;
  nativeStaleRenderDrops?:number;nativeRenderQueueRejected?:number;
  nativeRenderPending?:boolean;nativeDispatchedFamilies?:number;
  nativeSkippedFamilies?:number;brandAssetVersion?:number;
  nativeRingCacheHits?:number;nativeRingCacheMisses?:number;
};

const bridge=():NativeBridge|null=>{
  const value=NativeModules.CamideyizWidgetBridge as NativeBridge|undefined;
  return value&&typeof value.publishCalendar==='function'&&
    typeof value.getStatus==='function'?value:null;
};

function parseStatus(raw:string):AndroidWidgetNativeStatus{
  const data:unknown=JSON.parse(raw);
  if(!data||typeof data!=='object')throw new Error('Native widget status missing');
  const v=data as Partial<AndroidWidgetNativeStatus>;
  if(v.supported!==true||typeof v.persisted!=='boolean'||
    typeof v.installedNext!=='number'||typeof v.installedDay!=='number'||
    typeof v.lastAppliedAt!=='number'||typeof v.nextAlarmAt!=='number'||
    typeof v.lastReady!=='boolean'||typeof v.lastError!=='string'||
    typeof v.lastNextName!=='string'||typeof v.lastDateISO!=='string'||
    typeof v.nativeCityId!=='number'||typeof v.activeCityId!=='number'||
    typeof v.lastTransferStage!=='string'||typeof v.lastTransferError!=='string'||
    typeof v.lastTransferDetail!=='string'||typeof v.lastTransferAttemptAt!=='number'||
    typeof v.state!=='string'||
    typeof v.calendarEndsAt!=='number'||typeof v.lastHostDispatchAt!=='number')
    throw new Error('Malformed native widget status');
  // Native module intentionally cannot report actual launcher pixels.
  return {...v,launcherConfirmed:false} as AndroidWidgetNativeStatus;
}

/** Native receipt distinguishes written props, pinned host instances and
 * actual launcher render (which Android does not acknowledge to app code).
 * An absent bridge means the APK was built before the P0 native plugin.
 */
export async function getAndroidWidgetStatus():
Promise<AndroidWidgetNativeStatus|null>{
  const native=bridge();
  if(!native)return null;
  return parseStatus(await native.getStatus());
}

/** Native calendar identity is NOT inferred from the presence of a
 * timeline. A district can be selected before published hours are ready.
 * Only this call may discard a different district's previous timeline. */
export async function selectAndroidWidgetDistrict(cityId:number):
Promise<AndroidWidgetNativeStatus|null>{
  const native=bridge();
  if(!native)return null;
  if(!native.selectDistrict)throw Error('Widget native bridge is outdated');
  return parseStatus(await native.selectDistrict(cityId));
}
export async function reportAndroidWidgetTransfer(
  cityId:number,stage:'waiting'|'failed',detail:string,
):Promise<void>{
  const native=bridge();
  if(!native?.reportTransfer)return;
  await native.reportTransfer(cityId,stage,detail);
}

/** Native resync from already verified persisted data when the JS provider
 * is offline. Must only be used for the SAME district: no cross-city replay. */
export async function repairPersistedAndroidWidget(cityId:number):
Promise<AndroidWidgetNativeStatus|null>{
  const native=bridge();
  if(!native||typeof native.refreshNow!=='function'||cityId<=0)return null;
  const before=parseStatus(await native.getStatus());
  if(!before.hasTimeline||before.nativeCityId!==cityId)return null;
  return parseStatus(await native.refreshNow());
}

/** Send a validated future timeline to Android. Unlike expo-widgets' Android
 * updateTimeline (not supported), a native AlarmManager receiver switches the
 * persisted snapshot at each future prayer boundary, without waking React.
 * The system can delay inexact alarms under Doze; no false exact guarantee.
 */
export async function publishAndroidWidgetTimeline(
  days:readonly PrayerSchedule[],now:number,cityId:number,sourceAt:number,
):Promise<AndroidWidgetNativeStatus>{
  const native=bridge();
  if(!native)throw new Error(
    'Widget native köprüsü bulunamadı. CNG ile yeni release APK üret.',
  );
  if(!days.length||cityId<=0)
    throw new Error('Boş takvim native belleğe gönderilemez.');
  if(!Number.isFinite(sourceAt)||sourceAt<=0||sourceAt>now+60_000||
     now-sourceAt>16*24*60*60_000)
    throw new Error('Kaynak takvimin yayın doğrulaması eskimiş');
  const timeline=buildPrayerWidgetTimeline(days,now,100);
  if(!timeline.length||timeline[0].snapshot.status!=='ready')
    throw new Error('Doğrulanmış ileri tarihli namaz takvimi bulunamadı');
  // The native receiver does not calculate prayer times. Every boundary
  // already comes from published and structurally validated core schedules.
  const calendar={
    version:1,cityId,city:timeline[0].snapshot.city,generatedAt:now,sourceAt,
    entries:timeline.map(({date,snapshot})=>({
      at:date,props:toWidgetProps(snapshot),
    })),
  };
  const status=parseStatus(await native.publishCalendar(JSON.stringify(calendar)));
  if(status.lastError)throw new Error('Native widget: '+status.lastError);
  if(status.nativeCityId!==cityId||status.activeCityId!==cityId)
    throw new Error('Native ilçe kimliği uyuşmuyor; takvim kaydedilmedi');
  if(!status.hasTimeline||!status.persisted||!status.lastReady)
    throw new Error('Widget verileri native belleğe yazılamadı');
  return status;
}
