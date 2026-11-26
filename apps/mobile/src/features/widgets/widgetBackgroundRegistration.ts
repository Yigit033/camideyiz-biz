/**
 * Background task REGISTRATION/status only. This deliberately imports NO
 * prayer provider, notification reconciliation, widget timeline or calendar
 * engine. Keep registration cheap on every foreground launch.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import {hasAndroidNativeWidgetBridge} from '../native/nativeRuntime';
import {WIDGET_BACKGROUND_TASK} from './widgetTaskRegistration';

export const WIDGET_BACKGROUND_STATUS_KEY='@camideyiz/widget-background-status/v3';
export const WIDGET_BACKGROUND_INTERVAL_MINUTES=15;
export type WidgetBackgroundReport={
  lastAttempt:number;lastSuccess:number|null;lastNetwork:number|null;
  status:'updated'|'waiting-data'|'error';
  detail:string;
  registrationStatus?:string;registrationError?:string;registered?:boolean;
};
export async function readWidgetBackgroundReport():Promise<WidgetBackgroundReport|null>{
  try{
    const raw=await AsyncStorage.getItem(WIDGET_BACKGROUND_STATUS_KEY);
    if(!raw)return null;
    const s:unknown=JSON.parse(raw);
    if(!s||typeof s!=='object')return null;
    const v=s as WidgetBackgroundReport;
    return typeof v.lastAttempt==='number'&&
      (v.status==='updated'||v.status==='waiting-data'||v.status==='error')?v:null;
  }catch{return null;}
}

/** WorkManager registration is independent from native widget publication.
 * A failed/restricted task must be visible to QA but must NEVER stop the UI.
 */
export async function ensureWidgetBackgroundRefresh():Promise<boolean>{
  if(!hasAndroidNativeWidgetBridge())return false;
  let statusName='unavailable';
  let registered=false;
  let error='';
  try{
    const status=await BackgroundTask.getStatusAsync();
    statusName=status===BackgroundTask.BackgroundTaskStatus.Available
      ?'available':'restricted:'+String(status);
    if(status===BackgroundTask.BackgroundTaskStatus.Available){
      if(!await TaskManager.isTaskRegisteredAsync(WIDGET_BACKGROUND_TASK)){
        await BackgroundTask.registerTaskAsync(WIDGET_BACKGROUND_TASK,{
          minimumInterval:WIDGET_BACKGROUND_INTERVAL_MINUTES,
        });
      }
      registered=await TaskManager.isTaskRegisteredAsync(WIDGET_BACKGROUND_TASK);
      if(!registered)error='Görev kaydı TaskManager tarafından doğrulanamadı';
    }else error='Android arka plan görevi kısıtlı: '+statusName;
  }catch(cause){
    error=cause instanceof Error?cause.message:'Bilinmeyen arka plan kayıt hatası';
  }
  try{
    const previous=await readWidgetBackgroundReport();
    await AsyncStorage.setItem(WIDGET_BACKGROUND_STATUS_KEY,JSON.stringify({
      lastAttempt:previous?.lastAttempt??Date.now(),
      lastSuccess:previous?.lastSuccess??null,
      lastNetwork:previous?.lastNetwork??null,
      status:previous?.status??'waiting-data',
      detail:previous?.detail??'Arka plan görev durumu kontrol edildi',
      registrationStatus:statusName,registrationError:error,registered,
    } satisfies WidgetBackgroundReport));
  }catch{/* periodic widget registration remains independent of report storage */}
  return registered;
}
