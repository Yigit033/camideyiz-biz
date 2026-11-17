import {
  buildPrayerWidgetSnapshot,type PrayerSchedule,
} from '@camideyiz/core';
import {isExpoGoRuntime} from '../native/nativeRuntime';
import {toWidgetProps,type WidgetSyncResult} from './widgetSyncShared';
import {publishAndroidWidgetTimeline} from './widgetNativeDiagnostics.android';

// Metro may eagerly evaluate async import() chunks in Expo Go. Use a
// synchronous require *inside* the guarded native-only function instead.
// Expo's widget config plugin still discovers both initialLayout files.
declare const require:(path:string)=>unknown;

export async function syncPrayerWidgets(
  days:readonly PrayerSchedule[],nowMs:number,cityId=0,
):Promise<WidgetSyncResult>{
  if(isExpoGoRuntime())return {
    available:false,updated:false,
    detail:'Expo Go: gerçek widget için native Android APK gerekir.',
  };
  try{
    const next=require('./NextPrayerWidget.android') as typeof import('./NextPrayerWidget.android');
    const day=require('./PrayerDayWidget.android') as typeof import('./PrayerDayWidget.android');
    if(typeof next.default?.updateSnapshot!=='function'||
       typeof day.default?.updateSnapshot!=='function'){
      return {available:false,updated:false,
        detail:'Native Expo widget kaydı bulunamadı. Yeni APK kurulmalı.'};
    }
    const snapshot=toWidgetProps(buildPrayerWidgetSnapshot(days,nowMs));
    // Expo writes to shared preferences and enqueues a Glance refresh, but
    // does NOT acknowledge that an external launcher rendered the pixels.
    next.default.updateSnapshot(snapshot);
    day.default.updateSnapshot(snapshot);

    // Native P0 bridge persists validated future prayer boundaries and
    // schedules an inexact Android alarm for the NEXT transition. It also
    // returns real AppWidgetManager pinned-instance counts and verifies
    // the two currently stored Expo prop records agree.
    const native=await publishAndroidWidgetTimeline(days,nowMs,cityId);
    const total=native.installedNext+native.installedDay;
    if(!days.length){
      return {available:true,updated:native.persisted,
        detail:'Widget takvimi temizlendi. Kurulu widget: '+total+
          ' · Ana ekran görünümü ayrıca kontrol edilmeli.',
        installedNext:native.installedNext,installedDay:native.installedDay,
        lastNativeWriteAt:native.lastAppliedAt,nextNativeAlarmAt:native.nextAlarmAt,
        nativePersisted:native.persisted,launcherConfirmed:false};
    }
    return {
      available:true,updated:native.persisted,
      detail:total===0
        ?'Veriler Android native belleğine kaydedildi; ana ekrana henüz widget eklenmemiş.'
        :'Android yerel belleği doğrulandı, '+total+' widget bulundu. '+
          'Vakit geçişi için sistem alarmı planlandı. Ana ekran görüntüsü doğrulanmadı.',
      installedNext:native.installedNext,installedDay:native.installedDay,
      lastNativeWriteAt:native.lastAppliedAt,nextNativeAlarmAt:native.nextAlarmAt,
      nativePersisted:native.persisted,launcherConfirmed:false,
    };
  }catch(error){
    return {available:false,updated:false,
      detail:'Widget P0 native aktarım hatası: '+
        (error instanceof Error?error.message:'bilinmeyen hata')};
  }
}
