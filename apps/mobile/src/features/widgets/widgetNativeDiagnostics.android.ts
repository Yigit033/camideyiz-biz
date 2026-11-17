import {NativeModules} from 'react-native';
import {
  buildPrayerWidgetTimeline,type PrayerSchedule,
} from '@camideyiz/core';
import {toWidgetProps} from './widgetSyncShared';

type NativeBridge={
  publishCalendar:(json:string)=>Promise<string>;
  getStatus:()=>Promise<string>;
};

export type AndroidWidgetNativeStatus={
  supported:boolean;installedNext:number;installedDay:number;
  lastAppliedAt:number;nextAlarmAt:number;lastSyncAt:number;
  lastError:string;lastNextName:string;lastNextTime:string;
  lastCity:string;lastDateISO:string;lastReady:boolean;
  persisted:boolean;hasTimeline:boolean;launcherConfirmed:false;
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
    typeof v.lastNextName!=='string'||typeof v.lastDateISO!=='string')
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

/** Send a validated future timeline to Android. Unlike expo-widgets' Android
 * updateTimeline (not supported), a native AlarmManager receiver switches the
 * persisted snapshot at each future prayer boundary, without waking React.
 * The system can delay inexact alarms under Doze; no false exact guarantee.
 */
export async function publishAndroidWidgetTimeline(
  days:readonly PrayerSchedule[],now:number,cityId:number,
):Promise<AndroidWidgetNativeStatus>{
  const native=bridge();
  if(!native)throw new Error(
    'Widget native köprüsü bulunamadı. CNG ile yeni release APK üret.',
  );
  if(!days.length||cityId<=0){
    return parseStatus(await native.publishCalendar(''));
  }
  const timeline=buildPrayerWidgetTimeline(days,now,100);
  if(!timeline.length||timeline[0].snapshot.status!=='ready')
    throw new Error('Doğrulanmış ileri tarihli namaz takvimi bulunamadı');
  // The native receiver does not calculate prayer times. Every boundary
  // already comes from published and structurally validated core schedules.
  const calendar={
    version:1,cityId,city:timeline[0].snapshot.city,generatedAt:now,
    entries:timeline.map(({date,snapshot})=>({
      at:date,props:toWidgetProps(snapshot),
    })),
  };
  const status=parseStatus(await native.publishCalendar(JSON.stringify(calendar)));
  if(status.lastError)throw new Error('Native widget: '+status.lastError);
  if(!status.persisted||!status.lastReady)
    throw new Error('Widget verileri native belleğe yazılamadı');
  return status;
}
