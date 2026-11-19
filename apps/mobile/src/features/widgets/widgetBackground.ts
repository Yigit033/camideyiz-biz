import {AppState,Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  buildPrayerWidgetSnapshot,makeWidgetCalendarCache,parseWidgetCalendarCache,
  WIDGET_NETWORK_REFRESH_MS,zonedClock,
  type PrayerSchedule,type WidgetCalendarCache,validateAlertSettings,
} from '@camideyiz/core';
import {getMirrorPrayerTriplet,getPrayerTriplet,
  type PrayerPlaceSelection} from '../prayer/prayerApi';
import {configuredPrayerApi} from '../prayer/prayerApi';
import {hasAndroidNativeWidgetBridge} from '../native/nativeRuntime';
import {prepareWidgetDistrict,recordWidgetTransferIssue,
  recoverPrayerWidgets,syncPrayerWidgets} from './widgetSync';
import {
  reconcilePrayerNotifications,PRAYER_ALERT_PREFERENCES_KEY,
} from '../companion/notificationService';

import {WIDGET_BACKGROUND_STATUS_KEY as STATUS_KEY,
  readWidgetBackgroundReport,type WidgetBackgroundReport}
  from './widgetBackgroundRegistration';
export {readWidgetBackgroundReport,ensureWidgetBackgroundRefresh,
  WIDGET_BACKGROUND_INTERVAL_MINUTES} from './widgetBackgroundRegistration';
export type {WidgetBackgroundReport} from './widgetBackgroundRegistration';
const ACTIVE_PLACE_KEY='@camideyiz/widget-active-place/v3';
const CACHE_KEY='@camideyiz/widget-published-calendar/v3';
const LAST_TRANSFER_KEY='@camideyiz/widget-native-transfer/v1';

type ActivePlace=PrayerPlaceSelection&{
  source:WidgetCalendarCache['source'];
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
const enabled=()=>Platform.OS==='android'&&hasAndroidNativeWidgetBridge();
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

async function report(status:WidgetBackgroundReport['status'],detail:string,
  lastNetwork:number|null,success:boolean):Promise<void>{
  const previous=await readWidgetBackgroundReport();
  await AsyncStorage.setItem(STATUS_KEY,JSON.stringify({
    lastAttempt:Date.now(),lastSuccess:success?Date.now():previous?.lastSuccess??null,
    lastNetwork:lastNetwork??previous?.lastNetwork??null,status,detail,
    registrationStatus:previous?.registrationStatus,
    registrationError:previous?.registrationError,
    registered:previous?.registered,
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
  // Native selection is atomic and independent of provider availability.
  // Only a *different district* may clear a previous district's widget.
  await prepareWidgetDistrict(place?.id??0);
  await setWidgetActivePlace(place,source);
  if(!place)return {available:true,updated:false,
    detail:'İlçe henüz seçilmedi; native takvime boş veri gönderilmedi.'};
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
  // A temporary network/cache miss is not permission to erase the
  // Android-native calendar for the SAME district. Ask Android to redraw
  // its already validated persisted timeline first; city switches still
  // clear because nativeCityId must match the currently selected place.
  const recovered=selected.length===0?await recoverPrayerWidgets(place.id):null;
  let result:import('./widgetSyncShared').WidgetSyncResult;
  if(selected.length>0){
    result=await syncPrayerWidgets(selected,now,place.id,
      verifiedCache?.fetchedAt??now);
  }else{
    const reason=days.length>=2
      ?'Yayımlanmış takvim doğrulanamadı: tarih, ilçe ve kaynak zamanı kontrol edilmeli.'
      :'Uygulama henüz seçilen ilçe için güncel yayımlanmış vakit almadı.';
    await recordWidgetTransferIssue(place.id,'waiting',reason).catch(()=>undefined);
    result=recovered??{available:true,updated:false,detail:reason};
  }
  // Diagnostic distinction: an app preview may have valid hours while the
  // defensive native cache cannot accept the payload. Never mislabel that
  // as an Android launcher or notification-permission problem.
  // "Native çizildi" is not equivalent to "new data delivered".
  // Never claim a blank placeholder is an updated prayer calendar.
  if(result.updated&&selected.length){
    await noteNativeTransfer(active,selected,now).catch(()=>undefined);
  }else if(result.updated&&!selected.length){
    await AsyncStorage.removeItem(LAST_TRANSFER_KEY).catch(()=>undefined);
  }
  return result;
}

/** Explicit user repair bypasses stale React state and fetches fresh,
 * strictly validated published days directly for the selected district.
 * Never substitute a province's center or synthesize prayer times.
 * This is invoked only from a user action, not on every render.
 */
export async function fetchAndPublishVerifiedWidgetCalendar(
  place:PrayerPlaceSelection,source:WidgetCalendarCache['source'],
):Promise<import('./widgetSyncShared').WidgetSyncResult>{
  if(!enabled())return {available:false,updated:false,
    detail:'Native widget yalnız Android APK içinde kullanılabilir.'};
  try{
    await prepareWidgetDistrict(place.id);
    await setWidgetActivePlace(place,source);
    const today=zonedClock(new Date(),'Europe/Istanbul').dateISO;
    const result=source==='idamedya-diyanet-republished'
      ?await getMirrorPrayerTriplet(place,today)
      :await getPrayerTriplet(place.id,today);
    const entries=result.source==='idamedya-diyanet-republished'
      ?result.upcoming:[result.today,result.next];
    const fetchedAt=Date.parse(result.today.fetchedAt);
    const cache=makeWidgetCalendarCache(place.id,place.name,source,entries,fetchedAt);
    const now=Date.now();
    const valid=parseWidgetCalendarCache(cache,now,place.id);
    if(!valid||buildPrayerWidgetSnapshot(valid.days,now).status!=='ready')
      throw new Error('Seçili ilçe için yayımlanan güncel namaz vakitleri doğrulanamadı.');
    const current=parsePlace(await AsyncStorage.getItem(ACTIVE_PLACE_KEY));
    if(!current||current.id!==place.id||current.source!==source)
      return {available:true,updated:false,detail:
        'İlçe değiştiği için eski eşitleme güvenli biçimde iptal edildi.'};
    await saveForegroundWidgetCalendar(place,source,valid.days,valid.fetchedAt);
    const receipt=await syncPrayerWidgets(valid.days,Date.now(),place.id,valid.fetchedAt);
    if(receipt.updated)await noteNativeTransfer(current,valid.days,Date.now())
      .catch(()=>undefined);
    return receipt;
  }catch(error){
    const detail='Seçilen ilçenin yayımlanmış takvimi alınamadı: '+
      (error instanceof Error?error.message:'Bilinmeyen kaynak hatası');
    await recordWidgetTransferIssue(place.id,'waiting',detail).catch(()=>undefined);
    return {available:true,updated:false,detail};
  }
}

/** Runs without React components. Inexact WorkManager task, not a clock alarm.
 * Network refresh is limited to every two hours with a 72h published cache.
 * When offline, only already validated real provider data may be displayed. */
export async function runWidgetBackgroundRefresh():Promise<boolean>{
  if(!enabled())return false;
  if(AppState.currentState==='active')return true; // user-facing UI has priority
  const now=Date.now();
  const place=parsePlace(await AsyncStorage.getItem(ACTIVE_PLACE_KEY));
  if(!place){await report('waiting-data','İlçe henüz seçilmedi',null,false);return true;}
  // Paint the currently verified native snapshot FIRST, before a network
  // request can time out or WorkManager's short execution budget expires.
  const recoveredAtStart=await recoverPrayerWidgets(place.id);
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
  if(AppState.currentState==='active')return true;
  const latest=parsePlace(await AsyncStorage.getItem(ACTIVE_PLACE_KEY));
  if(!latest||latest.id!==place.id||latest.source!==place.source)return true;
  const usable=cached&&parseWidgetCalendarCache(cached,Date.now(),place.id);
  const snapshot=usable?buildPrayerWidgetSnapshot(usable.days,Date.now()):null;
  const selected= snapshot?.status==='ready'?usable!.days:[];
  const recovered=selected.length===0?await recoverPrayerWidgets(place.id):null;
  let result:import('./widgetSyncShared').WidgetSyncResult;
  if(selected.length){
    result=await syncPrayerWidgets(selected,Date.now(),place.id,usable?.fetchedAt??Date.now());
  }else{
    const reason=fetchError
      ?'Yayımlanmış takvim alınamadı: '+fetchError
      :'Seçilen ilçe için doğrulanmış güncel takvim henüz bulunmuyor.';
    await recordWidgetTransferIssue(place.id,'waiting',reason).catch(()=>undefined);
    result=recovered??{available:true,updated:false,detail:reason};
  }
  if(!result.updated){
    await report(selected.length?'error':'waiting-data',result.detail,networkAt,false);
    return false;
  }
  const hasCalendar=snapshot?.status==='ready';
  const hasData=hasCalendar||Boolean(recoveredAtStart?.updated||recovered?.updated);
  if(hasCalendar&&usable){
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
      ?(hasCalendar
        ?(fetchError?'Son doğrulanmış takvim kullanıldı; sağlayıcı: '+fetchError
          :'Yayımlanmış namaz vakitleri tekrar eşitlendi')
        :'Önceki doğrulanmış yerel takvimden widget çizimi yenilendi; ağ bağlantısı bekleniyor')+reminderDetail
      :'Güncel ve doğrulanmış ilçe takvimi henüz alınamadı',
    networkAt,Boolean(hasData));
  return true;
}

