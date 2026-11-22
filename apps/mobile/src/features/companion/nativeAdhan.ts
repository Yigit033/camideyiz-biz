import {NativeModules,Platform} from 'react-native';
import type {PrayerAlertEvent} from '@camideyiz/core';

type NativeBridge={
  getStatus:()=>Promise<string>;
  requestExactAlarmPermission:()=>Promise<boolean>;
  syncAlarms:(json:string)=>Promise<string>;
  clearAlarms:()=>Promise<boolean>;
  testEzan:()=>Promise<boolean>;
  /** Added later; an older installed APK may lack it. */
  openAppSettings?:()=>Promise<boolean>;
};
/** What happened at the last ezan or test, as recorded by the native side. */
export type AdhanOutcome=
  'STARTED'|'COMPLETED'|'STOPPED'|'LATE'|'SILENT'|'MUTED'|'BUSY'|'FAILED';
export type NativeAdhanStatus={
  supported:boolean;exactPermission:boolean;scheduled:number;nextAt:number|null;
  playInSilent:boolean;
  /** null when this APK cannot tell. */
  batteryUnrestricted:boolean|null;
  lastOutcome:{label:string;outcome:AdhanOutcome;at:number;test:boolean}|null;
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
  ['STARTED','COMPLETED','STOPPED','LATE','SILENT','MUTED','BUSY','FAILED'];
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
    playInSilent:data.playInSilent===true,
    batteryUnrestricted:typeof data.batteryUnrestricted==='boolean'
      ?data.batteryUnrestricted:null,
    lastOutcome:parseOutcome(data.lastOutcome),
  };
}
const UNSUPPORTED:NativeAdhanStatus={supported:false,exactPermission:false,scheduled:0,
  nextAt:null,playInSilent:false,batteryUnrestricted:null,lastOutcome:null};
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
export async function openNativeAppSettings():Promise<boolean>{
  if(typeof bridge?.openAppSettings!=='function')return false;
  return bridge.openAppSettings();
}
export const nativeAdhanSupported=bridge!==null;
