import type {PrayerSchedule} from '@camideyiz/core';
import {isExpoGoRuntime} from '../native/nativeRuntime';
import type {WidgetSyncResult} from './widgetSyncShared';
import {publishAndroidWidgetTimeline,repairPersistedAndroidWidget,
  selectAndroidWidgetDistrict,reportAndroidWidgetTransfer}
  from './widgetNativeDiagnostics.android';

/**
 * Android draws native RemoteViews; no isolated Expo widget JS engine.
 * The validated app calendar is written to Android before we acknowledge
 * it. A broadcast-style success is never reported as launcher pixel proof.
 * Existing app/WidgetKit flows and the iOS widget timeline are unaffected.
 */
/** District switch is the only path that can clear an old-city timeline.
 * A same-city network failure is never a cache invalidation signal. */
export async function prepareWidgetDistrict(cityId:number):Promise<void>{
  if(isExpoGoRuntime())return;
  const status=await selectAndroidWidgetDistrict(cityId);
  if(!status)throw new Error('Android widget köprüsü bulunamadı');
  if(status.activeCityId!==cityId)
    throw new Error('Android seçilen ilçeyi kaydetmedi');
}
export async function recordWidgetTransferIssue(
  cityId:number,stage:'waiting'|'failed',detail:string,
):Promise<void>{
  if(isExpoGoRuntime()||cityId<=0)return;
  await reportAndroidWidgetTransfer(cityId,stage,detail);
}

export async function syncPrayerWidgets(
  days:readonly PrayerSchedule[],nowMs:number,cityId=0,sourceAt=nowMs,
):Promise<WidgetSyncResult>{
  if(isExpoGoRuntime())return {
    available:false,updated:false,
    detail:'Expo Go: Ana ekran widget testleri için native APK gerekir.',
  };
  if(!days.length||cityId<=0)return {
    available:true,updated:false,
    detail:'Yayımlanmış takvim bekleniyor. Android’deki mevcut takvim silinmedi.',
  };
  try{
    const native=await publishAndroidWidgetTimeline(days,nowMs,cityId,sourceAt);
    const total=native.installedNext+native.installedDay;
    const result:WidgetSyncResult={
      available:true,
      updated:native.persisted&&native.lastReady&&
        native.hasTimeline&&native.nativeCityId===cityId,
      detail:total===0
        ?'Doğru vakitler Android belleğine kaydedildi. Ana ekrana widget ekleyebilirsin.'
        :'Native saatler kaydedildi; '+total+' kurulu widget için ekran güncellemesi gönderildi. '
          +'Ekranı cihaz üzerinde karşılaştır.',
      installedNext:native.installedNext,
      installedDay:native.installedDay,
      lastNativeWriteAt:native.lastAppliedAt,
      nextNativeAlarmAt:native.nextAlarmAt,
      nativePersisted:native.persisted,
      launcherConfirmed:false,
    };
    if(native.lastError)return {...result,updated:false,
      detail:'Native widget hatası: '+native.lastError};
    return result;
  }catch(error){
    const message=error instanceof Error?error.message:'bilinmeyen hata';
    await recordWidgetTransferIssue(cityId,'failed',
      'Native aktarım reddedildi: '+message).catch(()=>undefined);
    return {available:true,updated:false,
      detail:'Widget native aktarım hatası: '+message};
  }
}

/** Recover persisted current-district calendar even while the upstream
 * provider / AsyncStorage is temporarily unavailable. Never reuse another city. */
export async function recoverPrayerWidgets(cityId:number):Promise<WidgetSyncResult|null>{
  if(isExpoGoRuntime())return null;
  try{
    const status=await repairPersistedAndroidWidget(cityId);
    if(!status)return null;
    const count=status.installedNext+status.installedDay;
    return {
      available:true,updated:status.persisted&&status.lastReady&&!status.lastError,
      detail:status.lastError
        ?'Widget native kurtarma hatası: '+status.lastError
        :status.lastReady
          ?'Seçilen ilçenin kayıtlı yayımlanmış takvimi tekrar çizdirildi. '+count+' widget isteği gönderildi.'
          :'Kayıtlı takvimin geçerli günü kalmadı; güncel yayın bekleniyor.',
      installedNext:status.installedNext,installedDay:status.installedDay,
      lastNativeWriteAt:status.lastAppliedAt,nextNativeAlarmAt:status.nextAlarmAt,
      nativePersisted:status.persisted,launcherConfirmed:false,
    };
  }catch(error){
    return {available:true,updated:false,detail:
      'Widget kurtarma başarısız: '+(error instanceof Error?error.message:'Bilinmeyen hata')};
  }
}
