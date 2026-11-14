import * as Notifications from 'expo-notifications';
import {Platform} from 'react-native';
import {isExpoGoRuntime} from '../native/nativeRuntime';
import {
  createPrayerAlertPlan,
  type PrayerAlertEvent,type PrayerAlertSettings,type PrayerSchedule,
} from '@camideyiz/core';

const KIND='camideyiz-prayer-v2';
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
  if(Platform.OS!=='android'||isExpoGoRuntime())return;
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
  const title=early?event.label+' vaktine '+event.leadMinutes+' dakika':' '+event.label+' vakti';
  const body=early
    ?event.locationName+' · '+event.localTime+' için hatırlatma'
    :event.locationName+' · '+event.localTime+' namaz vakti';
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
    // Do not create native channels at startup while reminders are OFF.
    // Channels are needed only before scheduling an enabled reminder.
    if(enabled)await setPrayerChannels();
    const desired=enabled?createPrayerAlertPlan(days,settings,nowMs):[];
    const existingByKey=new Map(ours.map(r=>[String(r.content.data?.eventKey),r]));
    const wanted=new Set(desired.map(e=>e.key));
    // Reconcile ONLY Camideyiz prayer requests; never cancel unrelated app alerts.
    for(const old of ours){
      const key=String(old.content.data?.eventKey);
      const next=desired.find(e=>e.key===key);
      const expected=next?alertContent(next,cityId,settings.sound):null;
      const correct=Boolean(next&&expected&&
        old.content.data?.cityId===cityId &&
        old.content.data?.soundMode===settings.sound &&
        old.content.data?.localTime===next.localTime &&
        old.content.title===expected.title &&
        old.content.body===expected.body);
      if(!wanted.has(key)||!correct){
        await Notifications.cancelScheduledNotificationAsync(old.identifier);
        existingByKey.delete(key);
      }
    }
    for(const event of desired){
      if(existingByKey.has(event.key))continue;
      await Notifications.scheduleNotificationAsync({
        content:alertContent(event,cityId,settings.sound),
        trigger:{
          type:Notifications.SchedulableTriggerInputTypes.DATE,
          date:new Date(event.fireAt),
          ...(isExpoGoRuntime()?{}:{
            channelId:settings.sound==='silent'?CHANNEL_SILENT:CHANNEL_AUDIBLE,
          }),
          delivery:'bestEffort',
        },
      });
    }
    const actual=await Notifications.getAllScheduledNotificationsAsync();
    return {
      permission,scheduled:actual.filter(r=>owned(r)).length,
      nextAt:desired.length?desired[0].fireAt:null,error:null,
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
  if(data?.kind!==KIND||typeof data.eventKey!=='string')return null;
  const city=Number(data.cityId);
  return {
    id:data.eventKey,title:n.request.content.title??'Namaz vakti',
    eventKey:data.eventKey,body:n.request.content.body??'',
    receivedAt:Date.now(),cityId:Number.isSafeInteger(city)?city:null,
  };
}
