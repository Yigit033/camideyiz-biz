import {
  buildPrayerWidgetSnapshot,type PrayerSchedule,
} from '@camideyiz/core';
import {isExpoGoRuntime} from '../native/nativeRuntime';
import {toWidgetProps,type WidgetSyncResult} from './widgetSyncShared';

// Metro may eagerly evaluate async import() chunks in Expo Go. Use a
// synchronous require *inside* the guarded native-only function instead.
// Expo's widget config plugin still discovers both initialLayout files.
declare const require:(path:string)=>unknown;

export async function syncPrayerWidgets(
  days:readonly PrayerSchedule[],nowMs:number,
):Promise<WidgetSyncResult>{
  if(isExpoGoRuntime())return {
    available:false,updated:false,
    detail:'Expo Go: yalnızca widget önizlemesi. Ana ekran widget’ı için native uygulama derlemesi gerekli.',
  };
  try{
    const next=require('./NextPrayerWidget.android') as typeof import('./NextPrayerWidget.android');
    const day=require('./PrayerDayWidget.android') as typeof import('./PrayerDayWidget.android');
    if(typeof next.default?.updateSnapshot!=='function'||
       typeof day.default?.updateSnapshot!=='function'){
      return {available:false,updated:false,
        detail:'Native widget modülü yüklenemedi; uygulamayı widget desteğiyle yeniden derle.'};
    }
    const snapshot=toWidgetProps(buildPrayerWidgetSnapshot(days,nowMs));
    // Expo's updateSnapshot persists the props and requests a render. Explicit
    // reload asks Android's AppWidgetHost to redraw already pinned instances,
    // which some OEM launchers otherwise leave at their initialLayout.
    // These native calls do not prove launcher rendering: physical QA needed.
    next.default.updateSnapshot(snapshot);
    day.default.updateSnapshot(snapshot);
    next.default.reload();
    day.default.reload();
    return {available:true,updated:true,
      detail:snapshot.ready
        ?'Her iki widget için '+snapshot.city+' · '+snapshot.dateISO+
          ' namaz vakitleri aktarıldı (ana ekran görüntüsü ayrıca kontrol edilmeli).'
        :'Güncel takvim hazır olmadığından widget boş durumda.'};
  }catch(e){
    return {available:false,updated:false,
      detail:'Native widget güncellenemedi: '+
        (e instanceof Error?e.message:'bilinmeyen hata')};
  }
}
