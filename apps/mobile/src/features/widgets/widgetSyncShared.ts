import {
  type PrayerWidgetSnapshot,zonedClock,
} from '@camideyiz/core';
export type WidgetSyncResult={
  available:boolean;updated:boolean;detail:string;
  /** Native storage and installed-host diagnostics, never visual proof. */
  installedNext?:number;installedDay?:number;
  installedCompact?:number;installedFocus?:number;installedStrip?:number;
  installedMiniRing?:number;installedPremiumRing?:number;installedSlim?:number;
  lastNativeWriteAt?:number;nextNativeAlarmAt?:number;
  nativePersisted?:boolean;launcherConfirmed?:false;
};
export type PrayerWidgetProps={
  ready:boolean;city:string;dateISO:string;nextName:string;nextTime:string;
  nextAt:number;updatedAt:number;remainingMinutes:number;updatedClock:string;
  times:{key:string;label:string;time:string}[];
};
export function toWidgetProps(source:PrayerWidgetSnapshot):PrayerWidgetProps{
  const seconds=zonedClock(new Date(source.updatedAt),'Europe/Istanbul').secondsOfDay;
  const updatedClock=[Math.floor(seconds/3600),Math.floor((seconds%3600)/60)]
    .map(value=>String(value).padStart(2,'0')).join(':');
  return {
    updatedClock,ready:source.status==='ready',city:source.city,dateISO:source.dateISO,
    nextName:source.nextName,nextTime:source.nextTime,
    nextAt:source.nextAt,updatedAt:source.updatedAt,
    remainingMinutes:source.remainingMinutes,
    times:source.times.map(t=>({...t})),
  };
}
