import type {PrayerSchedule} from '@camideyiz/core';
import {isExpoGoRuntime} from '../native/nativeRuntime';
import type {WidgetSyncResult} from './widgetSyncShared';
import {publishAndroidWidgetTimeline,repairPersistedAndroidWidget} from './widgetNativeDiagnostics.android';

/**
 * Android draws native RemoteViews; no isolated Expo widget JS engine.
 * The validated app calendar is written to Android before we acknowledge
 * it. A broadcast-style success is never reported as launcher pixel proof.
 * Existing app/WidgetKit flows and the iOS widget timeline are unaffected.
 */
export async function syncPrayerWidgets(
  days:readonly PrayerSchedule[],nowMs:number,cityId=0,sourceAt=nowMs,
):Promise<WidgetSyncResult>{
  if(isExpoGoRuntime())return {
    available:false,updated:false,
    detail:'Expo Go: Ana ekran widget testleri için native APK gerekir.',
  };
  try{
    const native=await publishAndroidWidgetTimeline(days,nowMs,cityId,sourceAt);
    const total=native.installedNext+native.installedDay;
    const result:WidgetSyncResult={
      available:true,
      updated:native.persisted,
      detail:!days.length
        ?'Bu ilçe için doğrulanmış takvim bekleniyor; ana ekran gerektiğinde boş duruma geçer.'
        :total===0
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
    return {available:false,updated:false,
      detail:'Widget native aktarım hatası: '+
        (error instanceof Error?error.message:'bilinmeyen hata')};
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
