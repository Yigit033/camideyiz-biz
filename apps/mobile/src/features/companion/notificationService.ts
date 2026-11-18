import * as Notifications from 'expo-notifications';
import {Platform} from 'react-native';
import {hasAndroidNativeWidgetBridge,isExpoGoRuntime} from '../native/nativeRuntime';
import {clearNativeAdhan,nativeAdhanStatus,scheduleNativeAdhan} from './nativeAdhan';
import {
  createPrayerAlertPlan,
  type PrayerAlertEvent,type PrayerAlertSettings,type PrayerSchedule,
} from '@camideyiz/core';

const KIND='camideyiz-prayer-v2'; // Keep v2 to reconcile old installed APK requests.
export const PRAYER_ALERT_PREFERENCES_KEY='@camideyiz/prayer-alert-prefs/v2';
export const ANNOUNCEMENT_KIND='camideyiz-announcement-v1';
export const CHANNEL_AUDIBLE='namaz-hatirlatma-v2';
export const CHANNEL_SILENT='sessiz-namaz-hatirlatma-v2';
export type NotificationSyncReport={
  permission:'granted'|'denied'|'unknown';
  scheduled:number;nextAt:number|null;
  error:string|null;
};
export type NativePrayerEvent={
  id:string;eventKey:string;title:string;body:string;receivedAt:number;
  cityId:number|null;
};
export async function setPrayerChannels():Promise<void>{
  // Expo Go does not contain our native notification channel configuration;
  // its platform fallback is used for best-effort local notification tests.
  if(Platform.OS!=='android'||(isExpoGoRuntime()&&!hasAndroidNativeWidgetBridge()))return;
  await Notifications.setNotificationChannelAsync(CHANNEL_AUDIBLE,{
    name:'Namaz vakti hatırlatmaları',
    description:'Namaz vaktinde veya seçtiğiniz süre öncesinde sistem sesli bildirim',
    importance:Notifications.AndroidImportance.HIGH,
    sound:'default',
    vibrationPattern:[0,180,100,180],
    lightColor:'#D8BE81',
  });
  await Notifications.setNotificationChannelAsync(CHANNEL_SILENT,{
    name:'Sessiz namaz vakti bildirimleri',
    description:'Ses çıkarmadan namaz vakti bildirimi',
    importance:Notifications.AndroidImportance.DEFAULT,
    sound:null,
    enableVibrate:false,
  });
}
export function permissionAllowed(p:Notifications.NotificationPermissionsStatus):boolean{
  return p.granted||p.ios?.status===Notifications.IosAuthorizationStatus.PROVISIONAL;
}
export async function getPrayerPermission():Promise<'granted'|'denied'|'unknown'>{
  try{
    const p=await Notifications.getPermissionsAsync();
    if(permissionAllowed(p))return 'granted';
    return p.status==='undetermined'?'unknown':'denied';
  }catch{return 'unknown';}
}
export async function requestPrayerPermission():Promise<boolean>{
  await setPrayerChannels();
  const current=await Notifications.getPermissionsAsync();
  if(permissionAllowed(current))return true;
  const next=await Notifications.requestPermissionsAsync({
    ios:{allowAlert:true,allowBadge:true,allowSound:true},
  });
  return permissionAllowed(next);
}
export function alertContent(event:PrayerAlertEvent,cityId:number,sound:'default'|'silent'){
  const early=event.kind==='before';
  const title=early
    ?event.label+' vaktine '+event.leadMinutes+' dakika'
    :event.prayer==='gunes'?'Güneş doğdu':event.label+' vakti girdi';
  const body=early
    ?event.locationName+' · '+event.localTime+' için hatırlatma'
    :event.locationName+' · '+event.localTime+
      (event.prayer==='gunes'?' · Güneş doğuşu':' · Ezan vakti hatırlatması');
  return {
    title:title.trim(),body,
    sound:sound==='silent'?false:'default' as const,
    priority:Notifications.AndroidNotificationPriority.HIGH,
    data:{
      kind:KIND,eventKey:event.key,cityId,localTime:event.localTime,
      dateISO:event.dateISO,prayer:event.prayer,soundMode:sound,
    },
    color:'#0C6752',
  };
}
const owned=(request:Notifications.NotificationRequest):boolean=>{
  const d=request.content.data;
  return d?.kind===KIND&&typeof d.eventKey==='string';
};
export async function reconcilePrayerNotifications(
  days:readonly PrayerSchedule[],cityId:number,settings:PrayerAlertSettings,
  nowMs=Date.now(),
):Promise<NotificationSyncReport>{
  try{
    const permission=await getPrayerPermission();
    const all=await Notifications.getAllScheduledNotificationsAsync();
    const ours=all.filter(r=>owned(r));
    const enabled=settings.enabled&&permission==='granted';
    if(enabled)await setPrayerChannels();
    const desired=enabled?createPrayerAlertPlan(days,settings,nowMs):[];

    // Full ezan is Android-only native playback, never a notification sound.
    // A standard audible OS alert is retained as a fallback if special alarm
    // permission was not granted or native scheduling failed. Never silently
    // lose the reminder because the user requested an unavailable adhan.
    let nativeReady=false;
    let nativeCount=0;
    let nativeError:string|null=null;
    if(enabled&&settings.sound==='adhan'&&Platform.OS==='android'){
      try{
        const status=await nativeAdhanStatus();
        if(!status.supported)throw Error('Bu APK yerel ezan alarmlarını desteklemiyor.');
        if(!status.exactPermission)
          throw Error('Ezan için Android kesin alarm iznini vermen gerekiyor.');
        const scheduled=await scheduleNativeAdhan(desired);
        nativeReady=true;
        nativeCount=scheduled.scheduled;
      }catch(error){
        nativeError=error instanceof Error?error.message:'Ezan alarmı kurulamadı';
        await clearNativeAdhan().catch(()=>undefined);
      }
    }else{
      await clearNativeAdhan().catch(()=>undefined);
    }

    const notifications=desired.filter(event=>
      !(nativeReady && event.kind==='atTime' && event.prayer!=='gunes'));
    const effectiveSound=(_event:PrayerAlertEvent):'default'|'silent'=>
      settings.sound==='silent'?'silent':'default';
    const existingByKey=new Map(ours.map(r=>[String(r.content.data?.eventKey),r]));
    const wanted=new Set(notifications.map(e=>e.key));
    // Reconcile ONLY our own pending prayer requests. Announcements untouched.
    for(const old of ours){
      const key=String(old.content.data?.eventKey);
      const next=notifications.find(e=>e.key===key);
      const expected=next?alertContent(next,cityId,effectiveSound(next)):null;
      const correct=Boolean(next&&expected&&
        old.content.data?.cityId===cityId &&
        old.content.data?.soundMode===effectiveSound(next!) &&
        old.content.data?.localTime===next.localTime &&
        old.content.title===expected.title &&
        old.content.body===expected.body);
      if(!wanted.has(key)||!correct){
        await Notifications.cancelScheduledNotificationAsync(old.identifier);
        existingByKey.delete(key);
      }
    }
    for(const event of notifications){
      if(existingByKey.has(event.key))continue;
      const mode=effectiveSound(event);
      await Notifications.scheduleNotificationAsync({
        content:alertContent(event,cityId,mode),
        trigger:{
          type:Notifications.SchedulableTriggerInputTypes.DATE,
          date:new Date(event.fireAt),
          ...((isExpoGoRuntime()&&!hasAndroidNativeWidgetBridge())?{}:{
            channelId:mode==='silent'?CHANNEL_SILENT:CHANNEL_AUDIBLE,
          }),
          delivery:'bestEffort',
        },
      });
    }
    const actual=await Notifications.getAllScheduledNotificationsAsync();
    return {
      permission,scheduled:actual.filter(r=>owned(r)).length+nativeCount,
      nextAt:desired.length?desired[0].fireAt:null,error:nativeError,
    };
  }catch(error){
    return {permission:'unknown',scheduled:0,nextAt:null,
      error:error instanceof Error?error.message:'Bildirimleri ayarlama başarısız'};
  }
}

/** A location switch must never leave old-city alerts active while the new
 * calendar is loading or unavailable. Preserve only valid same-city rules.
 */
export async function prunePrayerNotifications(
  cityId:number,settings:PrayerAlertSettings,
):Promise<number>{
  const all=await Notifications.getAllScheduledNotificationsAsync();
  let removed=0;
  for(const item of all){
    if(!owned(item))continue;
    const data=item.content.data;
    const key=data?.prayer;
    const rule=typeof key==='string'&&key in settings.rules
      ?settings.rules[key as keyof typeof settings.rules]:null;
    const eventKey=String(data?.eventKey??'');
    const isEarly=eventKey.includes(':before:');
    if(data?.cityId!==cityId||!rule?.enabled||
       (isEarly?rule.minutesBefore!==Number(eventKey.split(':').at(-1)):!rule.atTime)){
      await Notifications.cancelScheduledNotificationAsync(item.identifier);
      removed++;
    }
  }
  return removed;
}

export function toInboxEvent(n:Notifications.Notification):NativePrayerEvent|null{
  const data=n.request.content.data;
  if(data?.kind===ANNOUNCEMENT_KIND){
    // Only announced messages that actually reach the native OS are kept
    // in the observed inbox. App restarts do not synthesize delivery.
    const key=typeof data.announcementId==='string'&&
      /^[0-9a-f-]{36}$/i.test(data.announcementId)
      ?'announcement:'+data.announcementId:null;
    if(!key)return null;
    return {
      id:key,eventKey:key,title:n.request.content.title??'Camideyiz Biz duyurusu',
      body:n.request.content.body??'',receivedAt:Date.now(),cityId:null,
    };
  }
  if(data?.kind!==KIND||typeof data.eventKey!=='string')return null;
  const city=Number(data.cityId);
  return {
    id:data.eventKey,title:n.request.content.title??'Namaz vakti',
    eventKey:data.eventKey,body:n.request.content.body??'',
    receivedAt:Date.now(),cityId:Number.isSafeInteger(city)?city:null,
  };
}
