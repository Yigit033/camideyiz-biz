import type {PrayerSchedule} from '@camideyiz/core';
import {isExpoGoRuntime} from '../native/nativeRuntime';
import type {WidgetSyncResult} from './widgetSyncShared';
import {publishAndroidWidgetTimeline} from './widgetNativeDiagnostics.android';

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
