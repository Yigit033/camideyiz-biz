import Constants from 'expo-constants';
import {
  buildPrayerWidgetSnapshot,type PrayerSchedule,
} from '@camideyiz/core';
import {toWidgetProps,type WidgetSyncResult} from './widgetSyncShared';

export async function syncPrayerWidgets(
  days:readonly PrayerSchedule[],nowMs:number,
):Promise<WidgetSyncResult>{
  if(Constants.appOwnership==='expo')return {
    available:false,updated:false,detail:'Widget için development/production build gerekli',
  };
  try{
    const [next,day]=await Promise.all([
      import('./NextPrayerWidget.android'),
      import('./PrayerDayWidget.android'),
    ]);
    const snapshot=toWidgetProps(buildPrayerWidgetSnapshot(days,nowMs));
    next.default.updateSnapshot(snapshot);
    day.default.updateSnapshot(snapshot);
    return {available:true,updated:true,
      detail:'Android widget yenilendi. Uygulama kapalıyken saat ilerleyişi garanti edilmez.'};
  }catch(e){
    return {available:true,updated:false,
      detail:e instanceof Error?e.message:'Android widget güncellenemedi'};
  }
}
