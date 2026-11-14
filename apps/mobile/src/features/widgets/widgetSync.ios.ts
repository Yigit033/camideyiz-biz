import {
  buildPrayerWidgetTimeline,type PrayerSchedule,
} from '@camideyiz/core';
import {isExpoGoRuntime} from '../native/nativeRuntime';
import {toWidgetProps,type WidgetSyncResult} from './widgetSyncShared';

// Do not use import() for a native widget entrypoint: Metro can eagerly
// evaluate the chunk when running Expo Go, even before our runtime guard.
declare const require:(path:string)=>unknown;

export async function syncPrayerWidgets(
  days:readonly PrayerSchedule[],nowMs:number,
):Promise<WidgetSyncResult>{
  if(isExpoGoRuntime())return {
    available:false,updated:false,
    detail:'Expo Go: yalnızca widget önizlemesi. WidgetKit için iOS native derlemesi gerekli.',
  };
  try{
    const timeline=buildPrayerWidgetTimeline(days,nowMs);
    if(!timeline.length)throw new Error('Güncellenebilir takvim yok');
    const next=require('./NextPrayerWidget.ios') as typeof import('./NextPrayerWidget.ios');
    const day=require('./PrayerDayWidget.ios') as typeof import('./PrayerDayWidget.ios');
    if(typeof next.default?.updateTimeline!=='function'||
       typeof day.default?.updateTimeline!=='function'){
      return {available:false,updated:false,
        detail:'Native WidgetKit eklentisi bulunamadı; iOS uygulamasını yeniden derle.'};
    }
    const entries=timeline.map(({date,snapshot})=>({
      date:new Date(date),props:toWidgetProps(snapshot),
    }));
    next.default.updateTimeline(entries);
    day.default.updateTimeline(entries);
    return {available:true,updated:true,
      detail:timeline.length+' zaman geçişi iOS WidgetKit’e gönderildi'};
  }catch(e){
    return {available:false,updated:false,
      detail:'iOS widget güncellenemedi: '+
        (e instanceof Error?e.message:'bilinmeyen hata')};
  }
}
