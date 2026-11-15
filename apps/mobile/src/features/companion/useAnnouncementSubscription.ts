import {useCallback,useEffect,useRef,useState} from 'react';
import {AppState,Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import {isExpoGoRuntime} from '@/features/native/nativeRuntime';
import {permissionAllowed} from './notificationService';

const CHANNEL='duyurular-v1';
const OPT_IN='@camideyiz/announcement-opt-in/v1';
const PENDING_DISABLE='@camideyiz/announcement-pending-disable/v1';
const ID_KEY='cb_announcement_device_id_v1';
const SECRET_KEY='cb_announcement_device_secret_v1';
const TOKEN_KEY='cb_announcement_expo_push_token_v1';
const SERVER_STATE_KEY='cb_announcement_server_enabled_v1';
const ID_PATTERN=/^[0-9a-f-]{36}$/i;
const SECRET_PATTERN=/^[0-9a-f]{64}$/;
const TOKEN_PATTERN=/^(?:ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]{10,220}\]$/;
type Status='disabled'|'not-configured'|'syncing'|'registered'|'pending-disable'|'error';
type Identity={installationId:string;secret:string};
export type AnnouncementState={
  ready:boolean;enabled:boolean;status:Status;detail:string;
  available:boolean;setEnabled:(next:boolean)=>Promise<boolean>;
  refresh:()=>Promise<void>;
};
function serverUrl():string|null{
  const raw=process.env.EXPO_PUBLIC_CB_ANNOUNCEMENTS_API_URL;
  if(!raw||!/^https:\/\//.test(raw))return null;
  // Do not let a remotely controlled URL become part of a request;
  // this is a compile-time Expo public environment variable only.
  return raw.replace(/\/+$/,'');
}
function expoProjectId():string|null{
  const value=Constants.easConfig?.projectId ??
    (Constants.expoConfig?.extra?.eas as {projectId?:string}|undefined)?.projectId ??
    process.env.EXPO_PUBLIC_CB_EAS_PROJECT_ID;
  return typeof value==='string'&&/^[a-f\d-]{36}$/i.test(value)?value:null;
}
function available():boolean{
  return (Platform.OS==='android'||Platform.OS==='ios')&&
    !isExpoGoRuntime()&&Boolean(serverUrl()&&expoProjectId());
}
async function identity(create:boolean):Promise<Identity|null>{
  let installationId=await SecureStore.getItemAsync(ID_KEY);
  let secret=await SecureStore.getItemAsync(SECRET_KEY);
  if(!installationId||!ID_PATTERN.test(installationId)||
    !secret||!SECRET_PATTERN.test(secret)){
    if(!create)return null;
    installationId=Crypto.randomUUID();
    const bytes=await Crypto.getRandomBytesAsync(32);
    secret=Array.from(bytes).map(v=>v.toString(16).padStart(2,'0')).join('');
    await SecureStore.setItemAsync(ID_KEY,installationId);
    await SecureStore.setItemAsync(SECRET_KEY,secret);
  }
  return {installationId,secret};
}
async function register(enabled:boolean,askPermission:boolean):Promise<void>{
  const base=serverUrl(),projectId=expoProjectId();
  if(!base||!projectId||isExpoGoRuntime())throw Error('Duyuru sunucusu veya push projesi henüz ayarlanmadı.');
  if(enabled&&askPermission){
    // Do not ask the user for OS permission when the server or migration
    // hasn't actually been configured by the owner.
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),9000);
    try{
      const status=await fetch(base+'/api/v1/announcements/health',{
        method:'GET',signal:controller.signal,
      });
      if(!status.ok)throw Error('Duyuru sunucusu henüz etkin değil.');
    }finally{clearTimeout(timeout);}
  }
  const cred=await identity(enabled);
  if(!cred){
    if(enabled)throw Error('Cihaz kaydı oluşturulamadı.');
    if(await SecureStore.getItemAsync(SERVER_STATE_KEY)==='true')
      throw Error('Eski sunucu kaydı için cihaz kimliği bulunamadı. Destek ile iletişime geç.');
    return;
  }
  if(Platform.OS==='android'){
    await Notifications.setNotificationChannelAsync(CHANNEL,{
      name:'Camideyiz Biz · Duyurular',
      description:'Ürün sahibinin isteğe bağlı haber ve özel duyuruları',
      importance:Notifications.AndroidImportance.DEFAULT,
      sound:'default',
      enableVibrate:true,
    });
  }
  let pushToken=await SecureStore.getItemAsync(TOKEN_KEY);
  if(enabled){
    let permission=await Notifications.getPermissionsAsync();
    if(!permissionAllowed(permission)&&askPermission){
      permission=await Notifications.requestPermissionsAsync({
        ios:{allowAlert:true,allowSound:true,allowBadge:false},
      });
    }
    if(!permissionAllowed(permission))
      throw Error('Bildirim izni kapalı. Telefon ayarlarından bildirimlere izin vermen gerekir.');
    const result=await Notifications.getExpoPushTokenAsync({projectId});
    pushToken=result.data;
    if(!TOKEN_PATTERN.test(pushToken))throw Error('Push kayıt anahtarı alınamadı.');
    await SecureStore.setItemAsync(TOKEN_KEY,pushToken);
  }
  if(!pushToken||!TOKEN_PATTERN.test(pushToken)){
    if(!enabled&&await SecureStore.getItemAsync(SERVER_STATE_KEY)!=='true')return;
    throw Error('Sunucudaki kayıt iptal edilemedi: önceki cihaz anahtarı kayıp.');
  }
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),14000);
  try{
    const response=await fetch(base+'/api/v1/announcements/subscription',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        ...cred,expoPushToken:pushToken,platform:Platform.OS,enabled,
      }),signal:controller.signal,
    });
    if(!response.ok){
      throw Error(response.status===429?'Çok sayıda deneme yapıldı; daha sonra yeniden dene.':
        response.status===503?'Duyuru servisi henüz aktif değil.':
          'Duyuru kaydı tamamlanamadı ('+response.status+').');
    }
  }finally{clearTimeout(timeout);}
}

/** Independent, explicitly opt-in broadcast channel. No device push token
 * is requested on first app launch, on prayer opt-in, or in Expo Go.
 */
export function useAnnouncementSubscription():AnnouncementState{
  const [ready,setReady]=useState(false);
  const [enabled,setOpted]=useState(false);
  const [status,setStatus]=useState<Status>('disabled');
  const [detail,setDetail]=useState('Duyurular isteğe bağlıdır.');
  const runId=useRef(0);
  const lastAttempt=useRef(0);
  const busy=useRef(false);
  const configured=available();

  const refresh=useCallback(async()=>{
    if(busy.current||!configured)return;
    const pending=await AsyncStorage.getItem(PENDING_DISABLE);
    const opted=await AsyncStorage.getItem(OPT_IN);
    const current=opted==='true';
    if(!current&&pending!=='true'){setStatus('disabled');return;}
    busy.current=true;
    const id=++runId.current;
    lastAttempt.current=Date.now();
    setStatus('syncing');
    try{
      await register(current,false);
      await SecureStore.setItemAsync(SERVER_STATE_KEY,current?'true':'false');
      if(!current)await AsyncStorage.removeItem(PENDING_DISABLE);
      if(runId.current===id){
        setStatus(current?'registered':'disabled');
        setDetail(current?'Bu cihaz özel duyurulara kayıtlı.':'Duyurular kapalı.');
      }
    }catch(error){
      if(runId.current===id){
        setStatus(!current?'pending-disable':'error');
        setDetail(error instanceof Error?error.message:'Duyuru bağlantısı kurulamadı.');
      }
    }finally{busy.current=false;}
  },[configured]);

  useEffect(()=>{
    let active=true;
    (async()=>{
      const opt=await AsyncStorage.getItem(OPT_IN);
      let pending=await AsyncStorage.getItem(PENDING_DISABLE);
      const remoteState=await SecureStore.getItemAsync(SERVER_STATE_KEY);
      // On iOS, a Keychain token may survive app reinstall while ordinary
      // preferences do not. Absence of opt-in then revokes that stale token.
      if(opt!=='true'&&remoteState==='true'&&pending!=='true'){
        await AsyncStorage.setItem(PENDING_DISABLE,'true');
        pending='true';
      }
      if(!active)return;
      setOpted(opt==='true');
      setReady(true);
      if(!configured){
        setStatus('not-configured');
        setDetail('Duyuru servisi ve Expo push kimlik bilgileri henüz etkinleştirilmedi.');
      }else if(opt==='true'||pending==='true'){
        void refresh();
      }
    })().catch(()=>{
      if(active){setReady(true);setStatus('error');
        setDetail('Duyuru tercihleri okunamadı.');}
    });
    return ()=>{active=false;};
  },[configured,refresh]);

  useEffect(()=>{
    if(!ready||!configured)return;
    const subscription=AppState.addEventListener('change',state=>{
      if(state==='active'&&Date.now()-lastAttempt.current>12*60*60_000)
        void refresh();
    });
    return ()=>subscription.remove();
  },[ready,configured,refresh]);

  const setEnabled=useCallback(async(next:boolean):Promise<boolean>=>{
    if(!ready||busy.current)return false;
    if(!next){
      // Remember explicit opt-out even if offline. Pending server disable
      // is retried on the next app foreground; never pretend it was sent.
      await AsyncStorage.multiSet([[OPT_IN,'false'],[PENDING_DISABLE,'true']]);
      setOpted(false);
      if(!configured){
        setStatus('pending-disable');
        setDetail('Duyurular bu cihazda kapalı; sunucudan silme bekleniyor.');
        return true;
      }
      await refresh();
      return true;
    }
    if(!configured){
      setStatus('not-configured');
      setDetail('Duyuru servisi henüz etkin değil. Canlı kayıt yapılamaz.');
      return false;
    }
    busy.current=true;
    const id=++runId.current;
    setStatus('syncing');
    try{
      await register(true,true);
      await AsyncStorage.setItem(OPT_IN,'true');
      await AsyncStorage.removeItem(PENDING_DISABLE);
      await SecureStore.setItemAsync(SERVER_STATE_KEY,'true');
      setOpted(true);
      if(runId.current===id){
        setStatus('registered');
        setDetail('Bu cihaz duyuru bildirimlerine kayıtlı.');
      }
      return true;
    }catch(error){
      setOpted(false);setStatus('error');
      setDetail(error instanceof Error?error.message:'Duyuru etkinleştirilemedi.');
      return false;
    }finally{busy.current=false;}
  },[configured,ready,refresh]);

  return {ready,enabled,status,detail,available:configured,setEnabled,refresh};
}
