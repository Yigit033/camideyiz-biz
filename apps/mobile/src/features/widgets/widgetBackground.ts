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
const LAST_TRANSFER_KEY='@camideyiz/widget-native-transfer/v1';
export const WIDGET_BACKGROUND_INTERVAL_MINUTES=15;

type ActivePlace=PrayerPlaceSelection&{
  source:WidgetCalendarCache['source'];
};
export type WidgetBackgroundReport={
  lastAttempt:number;lastSuccess:number|null;lastNetwork:number|null;
  status:'updated'|'waiting-data'|'error';
  detail:string;
};
export type LastWidgetTransfer={
  cityId:number;city:string;dateISO:string;sentAt:number;
  nextName:string;nextTime:string;
  times:{key:string;label:string;time:string}[];
};
export async function readLastWidgetTransfer():Promise<LastWidgetTransfer|null>{
  try{
    const raw=await AsyncStorage.getItem(LAST_TRANSFER_KEY);
    if(!raw)return null;
    const record:unknown=JSON.parse(raw);
    if(!record||typeof record!=='object'||Array.isArray(record))return null;
    const v=record as LastWidgetTransfer;
    if(!Number.isSafeInteger(v.cityId)||v.cityId<1||
      typeof v.city!=='string'||!v.city.trim()||
      typeof v.dateISO!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v.dateISO)||
      !Number.isFinite(v.sentAt)||v.sentAt>Date.now()+60_000||
      Date.now()-v.sentAt>72*60*60_000||
      typeof v.nextName!=='string'||typeof v.nextTime!=='string'||
      !Array.isArray(v.times)||v.times.length!==6)return null;
    return v;
  }catch{return null;}
}
async function noteNativeTransfer(
  place:ActivePlace,days:readonly PrayerSchedule[],now:number,
):Promise<void>{
  const snapshot=buildPrayerWidgetSnapshot(days,now);
  if(snapshot.status!=='ready')return;
  const current=parsePlace(await AsyncStorage.getItem(ACTIVE_PLACE_KEY));
  if(!current||current.id!==place.id||current.source!==place.source)return;
  await AsyncStorage.setItem(LAST_TRANSFER_KEY,JSON.stringify({
    cityId:place.id,city:snapshot.city,dateISO:snapshot.dateISO,sentAt:now,
    nextName:snapshot.nextName,nextTime:snapshot.nextTime,
    times:snapshot.times,
  } satisfies LastWidgetTransfer));
}
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
    await AsyncStorage.multiRemove([ACTIVE_PLACE_KEY,CACHE_KEY,STATUS_KEY,LAST_TRANSFER_KEY]);
    return;
  }
  if(former?.id!==place.id||former.source!==source){
    // Avoid displaying the previous district's successful background report.
    await AsyncStorage.multiRemove([CACHE_KEY,STATUS_KEY,LAST_TRANSFER_KEY]);
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

/**
 * Single foreground entrypoint: persist the selected district FIRST, then
 * validate and reuse its last published schedule. A transient source loading
 * state must not replace a valid already-rendered widget with placeholder.
 * A district switch clears both cache and native widget until new published
 * times for that exact selected district pass validation.
 *
 * UI observes only native updateSnapshot call success; OS launcher rendering
 * still requires the physical-device comparison in the release QA checklist.
 */
export async function syncForegroundWidgetCalendar(
  place:PrayerPlaceSelection|null,
  source:WidgetCalendarCache['source'],
  days:readonly PrayerSchedule[],
  publishedAt:number|null,
  now=Date.now(),
):Promise<import('./widgetSyncShared').WidgetSyncResult>{
  if(!enabled())return syncPrayerWidgets(days,now);
  await setWidgetActivePlace(place,source);
  if(!place)return syncPrayerWidgets([],now,0);
  // Validate the current foreground result directly. Native widget updates
  // must not depend on an AsyncStorage read/write round-trip succeeding.
  // Storage is still used for offline/headless WorkManager refreshes.
  const fresh=days.length>=2&&publishedAt!==null&&Number.isFinite(publishedAt)
    ?parseWidgetCalendarCache(
      makeWidgetCalendarCache(place.id,place.name,source,days,publishedAt),
      now,place.id)
    :null;
  if(fresh)await saveForegroundWidgetCalendar(
    place,source,days,publishedAt!);
  const active=parsePlace(await AsyncStorage.getItem(ACTIVE_PLACE_KEY));
  if(!active||active.id!==place.id||active.source!==source){
    return {available:true,updated:false,detail:'İlçe değişimi sırasında eşitleme yenilendi'};
  }
  const cache=await readCache(now,place.id);
  const verifiedCache=cache&&(!fresh||cache.fetchedAt>fresh.fetchedAt)
    ?cache:fresh??cache;
  const verified=verifiedCache?.days??[];
  const snapshot=buildPrayerWidgetSnapshot(verified,now);
  // Always clear a previous-district snapshot if the current district has no
  // valid published data; otherwise, preserve the same-district cache.
  const selected=snapshot.status==='ready'?verified:[];
  const result=await syncPrayerWidgets(selected,now,place.id,
    verifiedCache?.fetchedAt??now);
  // Diagnostic distinction: an app preview may have valid hours while the
  // defensive native cache cannot accept the payload. Never mislabel that
  // as an Android launcher or notification-permission problem.
  if(!selected.length&&days.length>=2&&snapshot.status!=='ready'&&result.updated){
    result.detail='Seçilen ilçe için widget takvimi doğrulanamadı. '+
      'Bugün ve ertesi günün altı namaz vakti kontrol edilmeli.';
  }
  if(result.updated&&selected.length){
    await noteNativeTransfer(active,selected,now).catch(()=>undefined);
  }else if(result.updated&&!selected.length){
    await AsyncStorage.removeItem(LAST_TRANSFER_KEY).catch(()=>undefined);
  }
  return result;
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
  const result=await syncPrayerWidgets(snapshot?.status==='ready'?usable!.days:[],
    Date.now(),place.id,usable?.fetchedAt??Date.now());
  if(!result.updated){
    await report('error',result.detail,networkAt,false);
    return false;
  }
  const hasData=snapshot?.status==='ready';
  if(hasData&&usable){
    await noteNativeTransfer(latest,usable.days,Date.now()).catch(()=>undefined);
  }
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
