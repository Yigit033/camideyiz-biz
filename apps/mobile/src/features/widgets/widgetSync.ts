import type {PrayerSchedule} from '@camideyiz/core';
import type {WidgetSyncResult} from './widgetSyncShared';
export async function syncPrayerWidgets(_days:readonly PrayerSchedule[],
  _nowMs:number,_cityId=0,_sourceAt=_nowMs):Promise<WidgetSyncResult>{
  return {available:false,updated:false,
    detail:'Yerel widget bu platformda desteklenmiyor'};
}
