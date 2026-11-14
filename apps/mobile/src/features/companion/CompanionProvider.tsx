import {
  createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,
  type PropsWithChildren,
} from 'react';
import {AppState} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {router} from 'expo-router';
import {
  DEFAULT_ALERT_SETTINGS,validateAlertSettings,
  type PrayerAlertSettings,type PrayerKey,type PrayerSchedule,
} from '@camideyiz/core';
import {useSharedPrayerSource} from '@/features/prayer/PrayerSourceProvider';
import {getPrayerPermission,requestPrayerPermission,reconcilePrayerNotifications,
  toInboxEvent,prunePrayerNotifications,type NativePrayerEvent,type NotificationSyncReport} from './notificationService';
import {syncPrayerWidgets} from '@/features/widgets/widgetSync';
import type {WidgetSyncResult} from '@/features/widgets/widgetSyncShared';

const PREFS='@camideyiz/prayer-alert-prefs/v2';
const INBOX='@camideyiz/observed-reminders/v2';
const SUPPRESSED='@camideyiz/inbox-deleted/v2';
const EMPTY_REPORT:NotificationSyncReport={
  permission:'unknown',scheduled:0,nextAt:null,error:null,
};
const EMPTY_WIDGET:WidgetSyncResult={
  available:false,updated:false,detail:'Widget henüz eşitlenmedi',
};
Notifications.setNotificationHandler({
  handleNotification:async(notification)=>({
    shouldShowBanner:true,shouldShowList:true,shouldSetBadge:false,
    shouldPlaySound:notification.request.content.sound==='default',
  }),
});
type CompanionContextValue={
  settings:PrayerAlertSettings;ready:boolean;
  permission:'granted'|'denied'|'unknown';sync:NotificationSyncReport;
  widget:WidgetSyncResult;syncing:boolean;inbox:readonly NativePrayerEvent[];
  setEnabled:(next:boolean)=>Promise<boolean>;
  setSound:(next:'default'|'silent')=>void;
  setRule:(key:PrayerKey,changes:Partial<PrayerAlertSettings['rules'][PrayerKey]>)=>void;
  refresh:()=>void;clearInbox:()=>void;deleteInbox:(id:string)=>void;
};
const Context=createContext<CompanionContextValue|null>(null);
function appendUnique(history:readonly NativePrayerEvent[],
  event:NativePrayerEvent|null,deleted:ReadonlySet<string>):NativePrayerEvent[]{
  if(!event||deleted.has(event.id))return [...history];
  return [event,...history.filter(x=>x.eventKey!==event.eventKey)]
    .sort((a,b)=>b.receivedAt-a.receivedAt).slice(0,120);
}
function validInbox(value:unknown):NativePrayerEvent[]{
  if(!Array.isArray(value))return [];
  return value.filter((x):x is NativePrayerEvent=>x!==null&&typeof x==='object'&&
    typeof x.id==='string'&&typeof x.eventKey==='string'&&typeof x.title==='string'&&
    typeof x.body==='string'&&typeof x.receivedAt==='number'&&
    Number.isFinite(x.receivedAt)).slice(0,120);
}
export function CompanionProvider({children}:PropsWithChildren){
  const source=useSharedPrayerSource();
  const [settings,setSettings]=useState<PrayerAlertSettings>(DEFAULT_ALERT_SETTINGS);
  const [inbox,setInbox]=useState<NativePrayerEvent[]>([]);
  const [ready,setReady]=useState(false);
  const [sync,setSync]=useState<NotificationSyncReport>(EMPTY_REPORT);
  const [widget,setWidget]=useState<WidgetSyncResult>(EMPTY_WIDGET);
  const [syncing,setSyncing]=useState(false);
  const [sequence,setSequence]=useState(0);
  const [permission,setPermission]=useState<'granted'|'denied'|'unknown'>('unknown');
  const lastForegroundSync=useRef(0);
  const syncVersion=useRef(0);
  const syncQueue=useRef<Promise<void>>(Promise.resolve());
  const deletedIds=useRef<Set<string>>(new Set());

  useEffect(()=>{
    let live=true;
    Promise.all([AsyncStorage.getItem(PREFS),AsyncStorage.getItem(INBOX),
      AsyncStorage.getItem(SUPPRESSED)])
      .then(([prefs,history,suppressed])=>{
        if(!live)return;
        try{if(prefs)setSettings(validateAlertSettings(JSON.parse(prefs) as unknown));}
        catch{/* corrupted settings revert to OFF; never enable without consent */}
        try{
          if(suppressed){
            const parsed:unknown=JSON.parse(suppressed);
            if(Array.isArray(parsed)&&parsed.every(id=>typeof id==='string'))
              deletedIds.current=new Set((parsed as string[]).slice(-512));
          }
          if(history)setInbox(validInbox(JSON.parse(history) as unknown)
            .filter(item=>!deletedIds.current.has(item.id)));
        }catch{/* corrupt inbox/deletion history ignored */}
      }).catch(()=>undefined).finally(()=>{if(live)setReady(true);});
    getPrayerPermission().then(p=>{if(live)setPermission(p);}).catch(()=>undefined);
    return ()=>{live=false;};
  },[]);
  useEffect(()=>{
    if(ready)AsyncStorage.setItem(PREFS,JSON.stringify(settings)).catch(()=>undefined);
  },[ready,settings]);
  useEffect(()=>{
    if(ready)AsyncStorage.setItem(INBOX,JSON.stringify(inbox)).catch(()=>undefined);
  },[ready,inbox]);
  useEffect(()=>{
    const received=Notifications.addNotificationReceivedListener(notification=>{
      setInbox(prev=>appendUnique(prev,toInboxEvent(notification),deletedIds.current));
    });
    const response=Notifications.addNotificationResponseReceivedListener(response=>{
      const event=toInboxEvent(response.notification);
      setInbox(prev=>appendUnique(prev,event,deletedIds.current));
      if(event)router.replace('/(tabs)');
    });
    // Recover any delivered items still present in the OS notification list.
    const collect=()=>{
      Notifications.getPresentedNotificationsAsync().then(items=>{
        setInbox(prev=>{
          let next=prev;
          for(const item of items)next=appendUnique(next,toInboxEvent(item),deletedIds.current);
          return next;
        });
      }).catch(()=>undefined);
    };
    collect();
    const appState=AppState.addEventListener('change',state=>{
      if(state!=='active')return;
      collect();
      if(Date.now()-lastForegroundSync.current>60_000){
        lastForegroundSync.current=Date.now();
        setSequence(n=>n+1);
        source.retry();
      }
      getPrayerPermission().then(setPermission).catch(()=>undefined);
    });
    const last=Notifications.getLastNotificationResponse();
    if(last){
      const found=toInboxEvent(last.notification);
      if(found){
        setInbox(prev=>appendUnique(prev,found,deletedIds.current));
        router.replace('/(tabs)');
      }
      Notifications.clearLastNotificationResponse();
    }
    return ()=>{received.remove();response.remove();appState.remove();};
  },[source.retry]);

  const days=useMemo(():readonly PrayerSchedule[]=>{
    const result=source.days;
    if(!result||!source.place||result.city.id!==source.place.id)return [];
    return result.source==='idamedya-diyanet-republished'
      ?result.upcoming:[result.today,result.next];
  },[source.days,source.place?.id]);
  const cityId=source.place?.id??0;

  useEffect(()=>{
    if(!ready)return;
    const id=++syncVersion.current;
    let active=true;
    const reconcile=async()=>{
      setSyncing(true);
      try{
        // If the upstream is temporarily offline, do not erase a user's
        // already scheduled valid reminders for the same district.
        if(days.length===0&&settings.enabled){
          // Remove previous-city alerts while keeping still-valid reminders
          // when only the data source is temporarily offline.
          if(cityId>0){
            try{await prunePrayerNotifications(cityId,settings);}
            catch{/* retry on next source update */}
            // Clear old-city native widget contents; no fabricated time.
            const placeholder=await syncPrayerWidgets([],Date.now());
            if(active&&id===syncVersion.current)setWidget(placeholder);
          }
          return;
        }
        const report=await reconcilePrayerNotifications(days,cityId,settings);
        if(active&&id===syncVersion.current){
          setSync(report);setPermission(report.permission);
        }
        // Widgets are independent from notification permission.
        if(days.length){
          const result=await syncPrayerWidgets(days,Date.now());
          if(active&&id===syncVersion.current)setWidget(result);
        }
      }finally{
        if(active&&id===syncVersion.current)setSyncing(false);
      }
    };
    // Serialize native scheduling. Rapid toggle/location changes must never
    // let an older asynchronous run overwrite a newer set of 60 OS requests.
    syncQueue.current=syncQueue.current.catch(()=>undefined)
      .then(()=>active?reconcile():Promise.resolve())
      .catch(error=>{
        if(active&&id===syncVersion.current){
          setSync(current=>({...current,error:
            error instanceof Error?error.message:'Bildirim eşitleme hatası'}));
          setSyncing(false);
        }
      });
    return ()=>{active=false;};
  },[ready,days,cityId,settings,sequence]);

  const setEnabled=useCallback(async(next:boolean)=>{
    if(next){
      try{
        const allowed=await requestPrayerPermission();
        setPermission(allowed?'granted':'denied');
        if(!allowed)return false;
      }catch{
        setPermission('denied');return false;
      }
    }
    setSettings(old=>({...old,enabled:next}));
    return true;
  },[]);
  const setSound=useCallback((next:'default'|'silent')=>
    setSettings(old=>({...old,sound:next})),[]);
  const setRule=useCallback((key:PrayerKey,
    changes:Partial<PrayerAlertSettings['rules'][PrayerKey]>)=>{
    setSettings(old=>validateAlertSettings({...old,rules:{
      ...old.rules,[key]:{...old.rules[key],...changes},
    }}));
  },[]);
  const refresh=useCallback(()=>{
    source.retry();
    setSequence(i=>i+1);
  },[source.retry]);
  const rememberDeletion=useCallback((ids:readonly string[])=>{
    const next=[...new Set([...deletedIds.current,...ids])].slice(-512);
    deletedIds.current=new Set(next);
    AsyncStorage.setItem(SUPPRESSED,JSON.stringify(next)).catch(()=>undefined);
  },[]);
  const clearInbox=useCallback(()=>{
    rememberDeletion(inbox.map(item=>item.id));
    setInbox([]);
  },[inbox,rememberDeletion]);
  const deleteInbox=useCallback((id:string)=>{
    rememberDeletion([id]);
    setInbox(old=>old.filter(item=>item.id!==id));
  },[rememberDeletion]);
  const value=useMemo(()=>({
    settings,ready,permission,sync,widget,syncing,inbox,
    setEnabled,setSound,setRule,refresh,clearInbox,deleteInbox,
  }),[settings,ready,permission,sync,widget,syncing,inbox,
      setEnabled,setSound,setRule,refresh,clearInbox,deleteInbox]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useCompanion():CompanionContextValue{
  const value=useContext(Context);
  if(!value)throw new Error('useCompanion must be under CompanionProvider');
  return value;
}
