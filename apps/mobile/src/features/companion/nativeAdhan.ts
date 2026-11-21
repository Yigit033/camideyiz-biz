import {NativeModules,Platform} from 'react-native';
import type {PrayerAlertEvent} from '@camideyiz/core';

type NativeBridge={
  getStatus:()=>Promise<string>;
  requestExactAlarmPermission:()=>Promise<boolean>;
  syncAlarms:(json:string)=>Promise<string>;
  clearAlarms:()=>Promise<boolean>;
  testEzan:()=>Promise<boolean>;
};
export type NativeAdhanStatus={
  supported:boolean;exactPermission:boolean;scheduled:number;nextAt:number|null;
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
  };
}
export async function nativeAdhanStatus():Promise<NativeAdhanStatus>{
  if(!bridge)return {supported:false,exactPermission:false,scheduled:0,nextAt:null};
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
  events:readonly PrayerAlertEvent[],precise:boolean,
):Promise<NativeAdhanStatus>{
  if(!bridge)throw Error('Bu sürüm Android kesin ezan alarmını desteklemiyor.');
  const raw=await bridge.syncAlarms(JSON.stringify({
    precise,
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
export const nativeAdhanSupported=bridge!==null;
