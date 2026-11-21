import type {PrayerSchedule} from '@camideyiz/core';
import type {WidgetSyncResult} from './widgetSyncShared';
export async function syncPrayerWidgets(_days:readonly PrayerSchedule[],
  _nowMs:number,_cityId=0,_sourceAt=_nowMs):Promise<WidgetSyncResult>{
  return {available:false,updated:false,
    detail:'Yerel widget bu platformda desteklenmiyor'};
}

export async function recoverPrayerWidgets(_cityId:number):Promise<WidgetSyncResult|null>{
  return null;
}

/** No Android native district state on this platform. */
export async function prepareWidgetDistrict(_cityId:number):Promise<void>{}
export async function recordWidgetTransferIssue(
  _cityId:number,_stage:'waiting'|'failed',_detail:string,
):Promise<void>{}
