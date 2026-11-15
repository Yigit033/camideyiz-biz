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
  toInboxEvent,prunePrayerNotifications,PRAYER_ALERT_PREFERENCES_KEY,
  type NativePrayerEvent,type NotificationSyncReport} from './notificationService';
import {useAnnouncementSubscription,type AnnouncementState}
  from './useAnnouncementSubscription';
import type {WidgetSyncResult} from '@/features/widgets/widgetSyncShared';
import {ensureWidgetBackgroundRefresh,syncForegroundWidgetCalendar,
  readLastWidgetTransfer,readWidgetBackgroundReport,
  type LastWidgetTransfer,type WidgetBackgroundReport}
  from '@/features/widgets/widgetBackground';

const PREFS=PRAYER_ALERT_PREFERENCES_KEY;
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
  backgroundRegistered:boolean;backgroundReport:WidgetBackgroundReport|null;
  lastWidgetTransfer:LastWidgetTransfer|null;
  announcement:AnnouncementState;
  setEnabled:(next:boolean)=>Promise<boolean>;
  setSound:(next:'default'|'silent')=>void;
  setEzanAtTimeForAll:(next:boolean)=>void;
  setRule:(key:PrayerKey,changes:Partial<PrayerAlertSettings['rules'][PrayerKey]>)=>void;
  refresh:()=>void;refreshWidgets:()=>Promise<void>;
  clearInbox:()=>void;deleteInbox:(id:string)=>void;
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
  const announcement=useAnnouncementSubscription();
  const [settings,setSettings]=useState<PrayerAlertSettings>(DEFAULT_ALERT_SETTINGS);
  const [inbox,setInbox]=useState<NativePrayerEvent[]>([]);
  const [ready,setReady]=useState(false);
  const [sync,setSync]=useState<NotificationSyncReport>(EMPTY_REPORT);
  const [widget,setWidget]=useState<WidgetSyncResult>(EMPTY_WIDGET);
  const [backgroundRegistered,setBackgroundRegistered]=useState(false);
  const [backgroundReport,setBackgroundReport]=useState<WidgetBackgroundReport|null>(null);
  const [lastWidgetTransfer,setLastWidgetTransfer]=useState<LastWidgetTransfer|null>(null);
  const [syncing,setSyncing]=useState(false);
  const [sequence,setSequence]=useState(0);
  const [permission,setPermission]=useState<'granted'|'denied'|'unknown'>('unknown');
  const lastForegroundSync=useRef(0);
  const syncVersion=useRef(0);
  const widgetVersion=useRef(0);
  const widgetQueue=useRef<Promise<void>>(Promise.resolve());
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
      if(event)router.replace(
        event.eventKey.startsWith('announcement:')?'/companion':'/(tabs)',
      );
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
        router.replace(found.eventKey.startsWith('announcement:')
          ?'/companion':'/(tabs)');
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

  // Native widget registration remains independent from local prayer
  // notification permissions. Do not retry background registration each time
  // the published calendar refreshes.
  useEffect(()=>{
    if(!ready)return;
    let live=true;
    (async()=>{
      try{
        const registered=await ensureWidgetBackgroundRefresh();
        if(live)setBackgroundRegistered(registered);
      }catch{if(live)setBackgroundRegistered(false);}
      const report=await readWidgetBackgroundReport();
      if(live)setBackgroundReport(report);
    })().catch(()=>undefined);
    return ()=>{live=false;};
  },[ready]);

  // Exactly one foreground writer. Persist the selected district first;
  // while the provider reloads we reuse ONLY a validated cache belonging to
  // that same district, rather than overwriting the widget with no-data.
  // Pending old-district writes are serialized and cancelled before execution.
  useEffect(()=>{
    if(!ready||(cityId===0&&source.status==='loading'))return;
    const version=++widgetVersion.current;
    let active=true;
    const place=source.place;
    const sourceKind=source.officialConfigured
      ?'diyanet-awqat-salah' as const
      :'idamedya-diyanet-republished' as const;
    const publishedAt=source.days?Date.parse(source.days.today.fetchedAt):null;
    const update=async()=>{
      try{
        const result=await syncForegroundWidgetCalendar(
          place,sourceKind,days,publishedAt,Date.now());
        if(active&&version===widgetVersion.current){
          setWidget(result);
          const record=await readLastWidgetTransfer();
          if(active&&version===widgetVersion.current)
            setLastWidgetTransfer(record?.cityId===place?.id?record:null);
        }
      }catch(error){
        if(active&&version===widgetVersion.current)setWidget({
          available:false,updated:false,
          detail:'Widget eşitleme hatası: '+
            (error instanceof Error?error.message:'Bilinmeyen hata'),
        });
      }
    };
    widgetQueue.current=widgetQueue.current.catch(()=>undefined)
      .then(()=>active?update():Promise.resolve());
    return ()=>{active=false;};
  },[ready,days,cityId,sequence,source.status,source.officialConfigured]);

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
          }
          return;
        }
        const report=await reconcilePrayerNotifications(days,cityId,settings);
        if(active&&id===syncVersion.current){
          setSync(report);setPermission(report.permission);
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
  const setEzanAtTimeForAll=useCallback((next:boolean)=>{
    setSettings(old=>{
      const rules={...old.rules};
      for(const key of ['imsak','ogle','ikindi','aksam','yatsi'] as const){
        rules[key]={...rules[key],enabled:next?true:rules[key].enabled,atTime:next};
      }
      // Güneş doğuşu bir ezan vakti değildir. Bu kısayol ne açarken ne
      // kapatırken kullanıcının bağımsız güneş doğuşu kuralına dokunmaz.
      return validateAlertSettings({...old,rules});
    });
  },[]);
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
  // Manual widget refresh uses already validated district hours immediately.
  // A network reload before writing could temporarily clear the launcher.
  const refreshWidgets=useCallback(async()=>{
    if(!ready)return;
    const place=source.place;
    const selectedSource=source.officialConfigured
      ?'diyanet-awqat-salah' as const
      :'idamedya-diyanet-republished' as const;
    const publishedAt=source.days?Date.parse(source.days.today.fetchedAt):null;
    const run=async()=>{
      try{
        const result=await syncForegroundWidgetCalendar(
          place,selectedSource,days,publishedAt,Date.now());
        setWidget(result);
        const latest=await readLastWidgetTransfer();
        setLastWidgetTransfer(latest?.cityId===place?.id?latest:null);
      }catch(error){
        setWidget({available:false,updated:false,
          detail:'Widget aktarılamadı: '+
            (error instanceof Error?error.message:'Beklenmeyen hata')});
      }
    };
    widgetQueue.current=widgetQueue.current.catch(()=>undefined).then(run);
    await widgetQueue.current;
  },[ready,source.place,source.days,source.officialConfigured,days]);

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
    settings,ready,permission,sync,widget,syncing,inbox,backgroundRegistered,backgroundReport,
    lastWidgetTransfer,announcement,
    setEnabled,setSound,setEzanAtTimeForAll,setRule,refresh,refreshWidgets,clearInbox,deleteInbox,
  }),[settings,ready,permission,sync,widget,syncing,inbox,backgroundRegistered,backgroundReport,
       lastWidgetTransfer,announcement,
      setEnabled,setSound,setEzanAtTimeForAll,setRule,refresh,refreshWidgets,clearInbox,deleteInbox]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useCompanion():CompanionContextValue{
  const value=useContext(Context);
  if(!value)throw new Error('useCompanion must be under CompanionProvider');
  return value;
}
