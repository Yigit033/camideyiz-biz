import type {PrayerSchedule} from '@camideyiz/core';
import type {WidgetSyncResult} from './widgetSyncShared';
export async function syncPrayerWidgets(_days:readonly PrayerSchedule[],
  _nowMs:number):Promise<WidgetSyncResult>{
  return {available:false,updated:false,
    detail:'Yerel widget bu platformda desteklenmiyor'};
}
