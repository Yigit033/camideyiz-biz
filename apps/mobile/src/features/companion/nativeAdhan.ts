import {NativeModules,Platform} from 'react-native';
import type {PrayerAlertEvent} from '@camideyiz/core';
import {isExpoGoRuntime} from '@/features/native/nativeRuntime';

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
const bridge:NativeBridge|null=
  Platform.OS==='android'&&!isExpoGoRuntime()
    ?(NativeModules.CamideyizAdhanBridge as NativeBridge|undefined)??null:null;

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
export async function scheduleNativeAdhan(events:readonly PrayerAlertEvent[]):Promise<NativeAdhanStatus>{
  if(!bridge)throw Error('Bu sürüm Android kesin ezan alarmını desteklemiyor.');
  const eligible=events.filter(e=>e.kind==='atTime'&&e.prayer!=='gunes');
  const raw=await bridge.syncAlarms(JSON.stringify(eligible.map(e=>({
    id:e.key,at:e.fireAt,label:e.label,
  }))));
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
