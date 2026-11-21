import {NativeModules,Platform} from 'react-native';
import {shouldSkipWidgetHeadlessRefresh} from './widgetHealthPolicy';

/** Lightweight, fail-closed headless check. No prayerApi, React tree,
 * native canvas, notification engine, AsyncStorage or background JS scheduler.
 */
export async function canSkipWidgetHeadlessRefresh(now=Date.now()):Promise<boolean>{
  if(Platform.OS!=='android')return false;
  const bridge=NativeModules.CamideyizWidgetBridge as
    {getStatus?:()=>Promise<string>}|undefined;
  if(typeof bridge?.getStatus!=='function')return false;
  try{
    const state:unknown=JSON.parse(await bridge.getStatus());
    return shouldSkipWidgetHeadlessRefresh(state,now);
  }catch{return false;}
}
