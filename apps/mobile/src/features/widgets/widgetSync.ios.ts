import Constants from 'expo-constants';
import {
  buildPrayerWidgetTimeline,buildPrayerWidgetSnapshot,
  type PrayerSchedule,
} from '@camideyiz/core';
import {toWidgetProps,type WidgetSyncResult} from './widgetSyncShared';

export async function syncPrayerWidgets(
  days:readonly PrayerSchedule[],nowMs:number,
):Promise<WidgetSyncResult>{
  if(Constants.appOwnership==='expo')return {
    available:false,updated:false,detail:'Widget için development/production build gerekli',
  };
  try{
    // The native registry is loaded ONLY in custom builds, never in Expo Go.
    const [next,day]=await Promise.all([
      import('./NextPrayerWidget.ios'),
      import('./PrayerDayWidget.ios'),
    ]);
    const timeline=buildPrayerWidgetTimeline(days,nowMs);
    if(!timeline.length)throw new Error('Güncellenebilir takvim yok');
    const entries=timeline.map(({date,snapshot})=>({
      date:new Date(date),props:toWidgetProps(snapshot),
    }));
    next.default.updateTimeline(entries);
    day.default.updateTimeline(entries);
    return {available:true,updated:true,
      detail:timeline.length+' zaman geçişi iOS WidgetKit’e gönderildi'};
  }catch(e){
    return {available:true,updated:false,
      detail:e instanceof Error?e.message:'iOS widget güncellenemedi'};
  }
}
