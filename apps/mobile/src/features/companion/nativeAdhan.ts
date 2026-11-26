import {NativeModules,Platform} from 'react-native';
import type {AdhanDeviceState,PrayerAlertEvent} from '@camideyiz/core';

/** One tap from an ezan blocker row to the system screen that fixes it. */
export type AdhanSettingsTarget=
  'exact'|'notifications'|'battery'|'background'|'sound'|'dnd'|'app';
type NativeBridge={
  getStatus:()=>Promise<string>;
  requestExactAlarmPermission:()=>Promise<boolean>;
  syncAlarms:(json:string)=>Promise<string>;
  clearAlarms:()=>Promise<boolean>;
  testEzan:()=>Promise<boolean>;
  /** Added later; an older installed APK may lack them. */
  openAppSettings?:()=>Promise<boolean>;
  openSettings?:(kind:AdhanSettingsTarget)=>Promise<boolean>;
  raiseAlarmVolume?:()=>Promise<number>;
  stopEzan?:()=>Promise<boolean>;
};
/** What happened at the last ezan or test, as recorded by the native side.
 * MISSED: the OS dropped a planned ezan while the phone was running
 * (background cleanup / Force Stop / no auto-launch after a reboot). */
export type AdhanOutcome=
  'STARTED'|'COMPLETED'|'STOPPED'|'LATE'|'SILENT'|'MUTED'|'BUSY'|'FAILED'|'MISSED';
export type NativeAdhanStatus={
  supported:boolean;exactPermission:boolean;scheduled:number;nextAt:number|null;
  /** Prayer name of nextAt ("Öğle"); empty when unknown. */
  nextLabel:string;
  playInSilent:boolean;
  /** null when this APK cannot tell. */
  batteryUnrestricted:boolean|null;
  lastOutcome:{label:string;outcome:AdhanOutcome;at:number;test:boolean}|null;
  /** Live phone state (null when this APK cannot tell). The native receiver
   * applies the very same checks at prayer time. */
  ringer:AdhanDeviceState['ringer'];
  interruption:AdhanDeviceState['interruption'];
  alarmVolume:number|null;
  /** The phone maker's battery manager stops background apps (ColorOS…). */
  backgroundManaged:boolean;
  /** An ezan (or test) is audible right now. */
  playing:boolean;
};
// A compiled native module is the reliable capability check: some standalone
// Android builds expose Expo runtime markers that resemble Expo Go.
const candidate=Platform.OS==='android'
  ?NativeModules.CamideyizAdhanBridge as Partial<NativeBridge>|undefined
  :undefined;
const bridge:NativeBridge|null=
  candidate&&typeof candidate.getStatus==='function'&&
  typeof candidate.syncAlarms==='function'&&
  typeof candidate.clearAlarms==='function'&&
  typeof candidate.requestExactAlarmPermission==='function'&&
  typeof candidate.testEzan==='function'
    ?candidate as NativeBridge:null;

const OUTCOMES:readonly AdhanOutcome[]=
  ['STARTED','COMPLETED','STOPPED','LATE','SILENT','MUTED','BUSY','FAILED','MISSED'];
function parseOutcome(value:unknown):NativeAdhanStatus['lastOutcome']{
  if(!value||typeof value!=='object')return null;
  const data=value as Record<string,unknown>;
  if(typeof data.outcome!=='string'||!OUTCOMES.includes(data.outcome as AdhanOutcome)||
     typeof data.at!=='number'||!Number.isFinite(data.at))return null;
  return {
    label:typeof data.label==='string'?data.label:'',
    outcome:data.outcome as AdhanOutcome,at:data.at,test:data.test===true,
  };
}
const RINGERS=['normal','vibrate','silent'] as const;
const FILTERS=['all','priority','alarms','none'] as const;
function oneOf<T extends string>(value:unknown,allowed:readonly T[]):T|null{
  return typeof value==='string'&&(allowed as readonly string[]).includes(value)
    ?value as T:null;
}
function parseStatus(raw:string):NativeAdhanStatus{
  const value:unknown=JSON.parse(raw);
  if(!value||typeof value!=='object')throw Error('Invalid native alarm status');
  const data=value as Record<string,unknown>;
  if(data.supported!==true||typeof data.exactPermission!=='boolean'||
     typeof data.scheduled!=='number'||typeof data.nextAt!=='number')
    throw Error('Incomplete native alarm status');
  return {
    supported:true,exactPermission:data.exactPermission,
    scheduled:data.scheduled,
    nextAt:data.nextAt>0?data.nextAt:null,
    nextLabel:typeof data.nextLabel==='string'?data.nextLabel.slice(0,40):'',
    playInSilent:data.playInSilent===true,
    batteryUnrestricted:typeof data.batteryUnrestricted==='boolean'
      ?data.batteryUnrestricted:null,
    lastOutcome:parseOutcome(data.lastOutcome),
    ringer:oneOf(data.ringer,RINGERS),
    interruption:oneOf(data.interruption,FILTERS),
    alarmVolume:typeof data.alarmVolume==='number'&&Number.isFinite(data.alarmVolume)
      ?data.alarmVolume:null,
    backgroundManaged:data.backgroundManaged===true,
    playing:data.playing===true,
  };
}
const UNSUPPORTED:NativeAdhanStatus={supported:false,exactPermission:false,scheduled:0,
  nextAt:null,nextLabel:'',playInSilent:false,batteryUnrestricted:null,lastOutcome:null,
  ringer:null,interruption:null,alarmVolume:null,backgroundManaged:false,playing:false};
export async function nativeAdhanStatus():Promise<NativeAdhanStatus>{
  if(!bridge)return UNSUPPORTED;
  return parseStatus(await bridge.getStatus());
}
export async function requestNativeAdhanPermission():Promise<boolean>{
  if(!bridge)return false;
  return bridge.requestExactAlarmPermission();
}
/** `events` must already be filtered with core `playsFullAdhan`, so the native
 * ezan set and the suppressed notification set can never diverge. Time and
 * place travel with each alarm: if the ezan cannot be voiced (silent phone,
 * call in progress, late delivery) Android posts "X vakti girdi" instead. */
export async function scheduleNativeAdhan(
  events:readonly PrayerAlertEvent[],precise:boolean,playInSilent:boolean,
):Promise<NativeAdhanStatus>{
  if(!bridge)throw Error('Bu sürüm Android kesin ezan alarmını desteklemiyor.');
  const raw=await bridge.syncAlarms(JSON.stringify({
    precise,playInSilent,
    events:events.map(e=>({
      id:e.key,at:e.fireAt,label:e.label,time:e.localTime,
      place:e.locationName.slice(0,80),
    })),
  }));
  return parseStatus(raw);
}
export async function clearNativeAdhan():Promise<void>{
  if(bridge)await bridge.clearAlarms();
}
export async function testNativeAdhan():Promise<void>{
  if(!bridge)throw Error('Tam ezan testi için Android uygulama sürümünü aç.');
  await bridge.testEzan();
}
export async function stopNativeAdhan():Promise<void>{
  if(typeof bridge?.stopEzan==='function')await bridge.stopEzan();
}
/** Opens the system screen for `target`; an older APK opens App info. */
export async function openAdhanSettings(target:AdhanSettingsTarget):Promise<boolean>{
  if(typeof bridge?.openSettings==='function')return bridge.openSettings(target);
  if(target==='exact')return requestNativeAdhanPermission();
  return openNativeAppSettings();
}
export async function raiseNativeAlarmVolume():Promise<boolean>{
  if(typeof bridge?.raiseAlarmVolume!=='function')return openAdhanSettings('sound');
  await bridge.raiseAlarmVolume();
  return true;
}
export async function openNativeAppSettings():Promise<boolean>{
  if(typeof bridge?.openAppSettings!=='function')return false;
  return bridge.openAppSettings();
}
export const nativeAdhanSupported=bridge!==null;
