import {
  type PrayerWidgetSnapshot,
} from '@camideyiz/core';
export type WidgetSyncResult={available:boolean;updated:boolean;detail:string};
export type PrayerWidgetProps={
  ready:boolean;city:string;dateISO:string;nextName:string;nextTime:string;
  nextAt:number;updatedAt:number;remainingMinutes:number;
  times:{key:string;label:string;time:string}[];
};
export function toWidgetProps(source:PrayerWidgetSnapshot):PrayerWidgetProps{
  return {
    ready:source.status==='ready',city:source.city,dateISO:source.dateISO,
    nextName:source.nextName,nextTime:source.nextTime,
    nextAt:source.nextAt,updatedAt:source.updatedAt,
    remainingMinutes:source.remainingMinutes,
    times:source.times.map(t=>({...t})),
  };
}
