import {Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import {
  buildPrayerWidgetSnapshot,makeWidgetCalendarCache,parseWidgetCalendarCache,
  WIDGET_NETWORK_REFRESH_MS,zonedClock,
  type PrayerSchedule,type WidgetCalendarCache,validateAlertSettings,
} from '@camideyiz/core';
import {getMirrorPrayerTriplet,getPrayerTriplet,
  type PrayerPlaceSelection} from '../prayer/prayerApi';
import {configuredPrayerApi} from '../prayer/prayerApi';
import {isExpoGoRuntime} from '../native/nativeRuntime';
import {syncPrayerWidgets} from './widgetSync';
import {
  reconcilePrayerNotifications,PRAYER_ALERT_PREFERENCES_KEY,
} from '../companion/notificationService';

export const WIDGET_BACKGROUND_TASK='camideyiz-widget-refresh-v3';
const ACTIVE_PLACE_KEY='@camideyiz/widget-active-place/v3';
const CACHE_KEY='@camideyiz/widget-published-calendar/v3';
const STATUS_KEY='@camideyiz/widget-background-status/v3';
export const WIDGET_BACKGROUND_INTERVAL_MINUTES=15;

type ActivePlace=PrayerPlaceSelection&{
  source:WidgetCalendarCache['source'];
};
export type WidgetBackgroundReport={
  lastAttempt:number;lastSuccess:number|null;lastNetwork:number|null;
  status:'updated'|'waiting-data'|'error';
  detail:string;
};
const enabled=()=>Platform.OS==='android'&&!isExpoGoRuntime();
const sourceKind=():WidgetCalendarCache['source']=>configuredPrayerApi()
  ?'diyanet-awqat-salah':'idamedya-diyanet-republished';

function parsePlace(raw:string|null):ActivePlace|null{
  if(!raw)return null;
  try{
    const p=JSON.parse(raw) as Partial<ActivePlace>;
    if(!p||!Number.isSafeInteger(p.id)||!p.id||p.id<1||
      !Number.isSafeInteger(p.stateId)||!p.stateId||p.stateId<1||
      typeof p.name!=='string'||p.name.length<2||p.name.length>100||
      typeof p.stateName!=='string'||p.stateName.length<2||
      p.stateName.length>100||p.source!==sourceKind())return null;
    return p as ActivePlace;
  }catch{return null;}
}

async function readCache(now:number,cityId:number):Promise<WidgetCalendarCache|null>{
  try{
    const raw=await AsyncStorage.getItem(CACHE_KEY);
    return raw?parseWidgetCalendarCache(JSON.parse(raw) as unknown,now,cityId):null;
  }catch{return null;}
}

export async function readWidgetBackgroundReport():Promise<WidgetBackgroundReport|null>{
  try{
    const raw=await AsyncStorage.getItem(STATUS_KEY);
    if(!raw)return null;
    const s:unknown=JSON.parse(raw);
    if(!s||typeof s!=='object')return null;
    const v=s as WidgetBackgroundReport;
    return typeof v.lastAttempt==='number'&&
      (v.status==='updated'||v.status==='waiting-data'||v.status==='error')?v:null;
  }catch{return null;}
}
async function report(status:WidgetBackgroundReport['status'],detail:string,
  lastNetwork:number|null,success:boolean):Promise<void>{
  const previous=await readWidgetBackgroundReport();
  await AsyncStorage.setItem(STATUS_KEY,JSON.stringify({
    lastAttempt:Date.now(),lastSuccess:success?Date.now():previous?.lastSuccess??null,
    lastNetwork:lastNetwork??previous?.lastNetwork??null,status,detail,
  } satisfies WidgetBackgroundReport));
}

/** Set current district BEFORE any background work runs. Never use location
 * permissions; this task follows the district explicitly selected in-app.
 * Clear the old calendar when a user switches districts/providers. */
export async function setWidgetActivePlace(
  place:PrayerPlaceSelection|null,source:WidgetCalendarCache['source'],
):Promise<void>{
  const former=parsePlace(await AsyncStorage.getItem(ACTIVE_PLACE_KEY));
  if(!place){
    await AsyncStorage.multiRemove([ACTIVE_PLACE_KEY,CACHE_KEY,STATUS_KEY]);
    return;
  }
  if(former?.id!==place.id||former.source!==source){
    // Avoid displaying the previous district's successful background report.
    await AsyncStorage.multiRemove([CACHE_KEY,STATUS_KEY]);
  }
  await AsyncStorage.setItem(ACTIVE_PLACE_KEY,JSON.stringify({...place,source}));
}

/** The foreground API already verified the provider's identity and clocks.
 * Persist the same validated days for best-effort offline night rollovers.
 */
export async function saveForegroundWidgetCalendar(
  place:PrayerPlaceSelection,source:WidgetCalendarCache['source'],
  days:readonly PrayerSchedule[],publishedAt:number,
):Promise<void>{
  if(!days.length||!Number.isFinite(publishedAt))return;
  const active=parsePlace(await AsyncStorage.getItem(ACTIVE_PLACE_KEY));
  if(active?.id!==place.id||active.source!==source)return;
  const cache=makeWidgetCalendarCache(place.id,place.name,source,days,publishedAt);
  if(!parseWidgetCalendarCache(cache,Date.now(),place.id))return;
  // Never replace a newer background-fetched copy with an older foreground
  // state when an app resumes during a background fetch.
  const prior=await readCache(Date.now(),place.id);
  if(prior&&prior.fetchedAt>cache.fetchedAt)return;
  await AsyncStorage.setItem(CACHE_KEY,JSON.stringify(cache));
}

/** Runs without React components. Inexact WorkManager task, not a clock alarm.
 * Network refresh is limited to every two hours with a 72h published cache.
 * When offline, only already validated real provider data may be displayed. */
export async function runWidgetBackgroundRefresh():Promise<boolean>{
  if(!enabled())return false;
  const now=Date.now();
  const place=parsePlace(await AsyncStorage.getItem(ACTIVE_PLACE_KEY));
  if(!place){await report('waiting-data','İlçe henüz seçilmedi',null,false);return true;}
  let cached=await readCache(now,place.id);
  let networkAt:null|number=null;
  let fetchError='';
  const ready=cached&&buildPrayerWidgetSnapshot(cached.days,now).status==='ready';
  if(!ready||now-(cached?.fetchedAt??0)>=WIDGET_NETWORK_REFRESH_MS){
    try{
      const today=zonedClock(new Date(now),'Europe/Istanbul').dateISO;
      const result=place.source==='idamedya-diyanet-republished'
        ?await getMirrorPrayerTriplet(place,today)
        :await getPrayerTriplet(place.id,today);
      const entries=result.source==='idamedya-diyanet-republished'
        ?result.upcoming:[result.today,result.next];
      const newCache=makeWidgetCalendarCache(
        place.id,place.name,place.source,entries,Date.parse(result.today.fetchedAt));
      if(!parseWidgetCalendarCache(newCache,Date.now(),place.id))
        throw new Error('Yayımlanmış takvim doğrulanamadı');
      // Recheck the district after async network work; an in-flight request
      // from a previous district must never overwrite the new one.
      const current=parsePlace(await AsyncStorage.getItem(ACTIVE_PLACE_KEY));
      if(!current||current.id!==place.id||current.source!==place.source)return true;
      cached=newCache;
      networkAt=Date.now();
      await AsyncStorage.setItem(CACHE_KEY,JSON.stringify(newCache));
    }catch(error){
      fetchError=error instanceof Error?error.message:'Kaynak erişim hatası';
    }
  }
  const latest=parsePlace(await AsyncStorage.getItem(ACTIVE_PLACE_KEY));
  if(!latest||latest.id!==place.id||latest.source!==place.source)return true;
  const usable=cached&&parseWidgetCalendarCache(cached,Date.now(),place.id);
  const snapshot=usable?buildPrayerWidgetSnapshot(usable.days,Date.now()):null;
  const result=await syncPrayerWidgets(snapshot?.status==='ready'?usable!.days:[],Date.now());
  if(!result.updated){
    await report('error',result.detail,networkAt,false);
    return false;
  }
  const hasData=snapshot?.status==='ready';
  let reminderDetail='';
  if(hasData&&usable){
    try{
      const raw=await AsyncStorage.getItem(PRAYER_ALERT_PREFERENCES_KEY);
      if(raw){
        const settings=validateAlertSettings(JSON.parse(raw) as unknown);
        if(settings.enabled){
          // This reuses only real published times and never asks for
          // notification permission while the app is backgrounded.
          const next=await reconcilePrayerNotifications(
            usable.days,place.id,settings,Date.now());
          reminderDetail=next.error
            ?' · Uyarı eşitlemesi başarısız'
            :' · '+next.scheduled+' namaz bildirimi yeniden planlandı';
        }
      }
    }catch{
      reminderDetail=' · Bildirim takvimi yenileme hatası';
    }
  }
  await report(hasData?'updated':'waiting-data',
    hasData
      ?(fetchError?'Son doğrulanmış takvim kullanıldı; sağlayıcı: '+fetchError
        :'Yayımlanmış namaz vakitleri tekrar eşitlendi')+reminderDetail
      :'Güncel ve doğrulanmış ilçe takvimi henüz alınamadı',
    networkAt,Boolean(hasData));
  return true;
}

/** Register in module scope for headless Android startup, as Expo TaskManager
 * requires. Keep this file imported by app/_layout.tsx at top level. */
if(enabled()){
  TaskManager.defineTask(WIDGET_BACKGROUND_TASK,async()=>{
    try{
      const ok=await runWidgetBackgroundRefresh();
      return ok?BackgroundTask.BackgroundTaskResult.Success
        :BackgroundTask.BackgroundTaskResult.Failed;
    }catch(error){
      try{await report('error',error instanceof Error?error.message:'Arka plan senkronizasyon hatası',null,false);}
      catch{/* best-effort telemetry only */}
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

/** Optional best-effort refresh never requests notification/location permissions. */
export async function ensureWidgetBackgroundRefresh():Promise<boolean>{
  if(!enabled())return false;
  const status=await BackgroundTask.getStatusAsync();
  if(status!==BackgroundTask.BackgroundTaskStatus.Available)return false;
  if(!await TaskManager.isTaskRegisteredAsync(WIDGET_BACKGROUND_TASK)){
    await BackgroundTask.registerTaskAsync(WIDGET_BACKGROUND_TASK,{
      minimumInterval:WIDGET_BACKGROUND_INTERVAL_MINUTES,
    });
  }
  return true;
}
