import * as Notifications from 'expo-notifications';
import {Platform} from 'react-native';
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
  if(Platform.OS!=='android')return;
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
    vibrationPattern:[0],
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
      dateISO:event.dateISO,prayer:event.prayer,
    },
    color:'#0C6752',
  };
}
const owned=(request:Notifications.NotificationRequest):boolean=>{
  const d=request.content.data;
  return d?.kind===KIND&&typeof d.eventKey==='string';
};
const signature=(request:Notifications.NotificationRequest):string=>{
  const d=request.content.data;
  return [
    String(d?.eventKey),String(d?.cityId),
    String(request.content.title),String(request.content.body),
    String(request.content.sound),
    // Native trigger date is serialized differently on Android/iOS. The
    // local event key and exact source time are encoded into content data.
    String(d?.localTime),
  ].join('|');
};
export async function reconcilePrayerNotifications(
  days:readonly PrayerSchedule[],cityId:number,settings:PrayerAlertSettings,
  nowMs=Date.now(),
):Promise<NotificationSyncReport>{
  try{
    await setPrayerChannels();
    const permission=await getPrayerPermission();
    const all=await Notifications.getAllScheduledNotificationsAsync();
    const ours=all.filter(r=>owned(r));
    const enabled=settings.enabled&&permission==='granted';
    const desired=enabled?createPrayerAlertPlan(days,settings,nowMs):[];
    const existingByKey=new Map(ours.map(r=>[String(r.content.data.eventKey),r]));
    const wanted=new Set(desired.map(e=>e.key));
    // Reconcile ONLY Camideyiz prayer requests; never cancel unrelated app alerts.
    for(const old of ours){
      const key=String(old.content.data.eventKey);
      const next=desired.find(e=>e.key===key);
      const correct=next&&
        signature(old)===signature({
          ...old,content:{...old.content,...alertContent(next,cityId,settings.sound)},
        });
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
          channelId:settings.sound==='silent'?CHANNEL_SILENT:CHANNEL_AUDIBLE,
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
