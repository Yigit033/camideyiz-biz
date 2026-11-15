import {validateTriplet,type OfficialTriplet,parseMirrorStates,parseMirrorCities,parseBackupDiyanetCities,parseMirrorTriplet,parseEmushafTriplet,type MirrorTriplet} from '@camideyiz/core';

export type PrayerPlaceSelection={id:number;name:string;stateId:number;stateName:string};
export type StateOption={id:number;name:string;country_id:number};
export type CityOption={id:number;name:string;state_id:number};

export function configuredPrayerApi():boolean {
  return Boolean(process.env.EXPO_PUBLIC_PRAYER_API_URL?.trim());
}
function endpoint(path:string):string{
  const raw=process.env.EXPO_PUBLIC_PRAYER_API_URL?.trim().replace(/\/+$/,'');
  if(!raw)throw new Error('Prayer API URL is not configured');
  if(!/^https:\/\//i.test(raw)&&!(__DEV__&&/^http:\/\/(?:localhost|127\.0\.0\.1|192\.168\.|10\.|172\.)/.test(raw)))
    throw new Error('A secure HTTPS prayer API URL is required');
  return raw+path;
}
async function request(path:string):Promise<unknown>{
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),9000);
  try{
    const result=await fetch(endpoint(path),{
      headers:{Accept:'application/json'},method:'GET',
      signal:controller.signal,
    });
    if(!result.ok)throw new Error('Prayer API HTTP '+result.status);
    return result.json();
  }finally{clearTimeout(timeout);}
}
export async function getStates():Promise<StateOption[]> {
  if(!configuredPrayerApi())return getMirrorStates();
  const r=await request('/api/v1/states');
  if(!r||typeof r!=='object'||!Array.isArray((r as {states?:unknown}).states))throw new Error('Invalid state directory');
  return (r as {states:StateOption[]}).states.filter(x=>Number.isSafeInteger(x.id)&&x.id>0&&typeof x.name==='string');
}
export async function getCities(stateId:number):Promise<CityOption[]> {
  if(!configuredPrayerApi())return getMirrorCities(stateId);
  const r=await request('/api/v1/cities?stateId='+stateId);
  if(!r||typeof r!=='object'||!Array.isArray((r as {cities?:unknown}).cities))throw new Error('Invalid city directory');
  return (r as {cities:CityOption[]}).cities.filter(x=>Number.isSafeInteger(x.id)&&x.id>0&&
    x.state_id===stateId&&typeof x.name==='string');
}
export async function getPrayerTriplet(cityId:number,dateISO:string):Promise<OfficialTriplet>{
  const raw=await request('/api/v1/prayer-times?cityId='+cityId+'&date='+encodeURIComponent(dateISO));
  return validateTriplet(raw,cityId,dateISO);
}


// idamedya.org is a free, independently run republisher of prayer times
// claimed by its own payload to originate from Diyanet. It is NOT Diyanet's
// authorized Awqat Salah API. No secret is required, no local calculations.
const MIRROR_ROOT='https://idamedya.org/api/v1/namaz';
async function mirrorGet(path:string,timeoutMs=10000):Promise<unknown>{
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(MIRROR_ROOT+path,{
      method:'GET',headers:{Accept:'application/json'},
      signal:controller.signal,
    });
    if(!response.ok)throw new Error('Free calendar provider HTTP '+response.status);
    return await response.json();
  }finally{clearTimeout(timeout);}
}
export async function getMirrorStates():Promise<StateOption[]>{
  return parseMirrorStates(await mirrorGet('/iller'));
}
// The public prayer provider sometimes fails on district directory requests.
// A separate public Diyanet-coded DIRECTORY is fallback only; prayer hours
// always come from the explicitly selected original times provider.
const BACKUP_DIRECTORY='https://ezanvakti.emushaf.net';
async function backupDirectory(stateId:number):Promise<CityOption[]>{
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),9500);
  try{
    const result=await fetch(BACKUP_DIRECTORY+'/ilceler/'+stateId,{
      method:'GET',headers:{Accept:'application/json'},signal:controller.signal,
    });
    if(!result.ok)throw new Error('Backup directory HTTP '+result.status);
    return parseBackupDiyanetCities(await result.json(),stateId);
  }finally{clearTimeout(timeout);}
}
export async function getMirrorCities(stateId:number):Promise<CityOption[]>{
  if(!Number.isSafeInteger(stateId)||stateId<=0)throw new Error('Invalid province');
  try{
    const result=parseMirrorCities(await mirrorGet('/ilceler/'+stateId,4500),stateId);
    if(result.length)return result;
  }catch{/* The directory alone may be unavailable; try verified ID-format backup. */}
  return backupDirectory(stateId);
}
/** Published Diyanet district code, never city centre substitution. Two
 * independent sources: Idamedya first, emushaf if the request or the strict
 * parsing/identity/date checks fail. Never calculate or invent prayer hours. */
export async function getMirrorPrayerTriplet(
  place:PrayerPlaceSelection,dateISO:string,
):Promise<MirrorTriplet>{
  if(!Number.isSafeInteger(place.id)||place.id<=0||place.id>1_000_000)
    throw new Error('invalid_district');
  let firstError:unknown=null;
  try{
    const raw=await mirrorGet('/'+place.id,6500);
    return parseMirrorTriplet(raw,place.id,dateISO,place.name,new Date().toISOString());
  }catch(e){firstError=e;}
  // The fallback directory and its prayer endpoint share the same Diyanet
  // district IDs. Published clock values are validated as carefully as primary.
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8500);
  try{
    const response=await fetch(BACKUP_DIRECTORY+'/vakitler/'+place.id,{
      method:'GET',headers:{Accept:'application/json'},
      signal:controller.signal,
    });
    if(!response.ok)throw new Error('backup_http_'+response.status);
    return parseEmushafTriplet(await response.json(),
      place.id,dateISO,place.name,new Date().toISOString());
  }catch(backupError){
    // Known categories only: never surface arbitrary server contents to UI.
    const name=(error:unknown)=>error instanceof Error?error.message:'unknown';
    const a=name(firstError).toLowerCase(),b=name(backupError).toLowerCase();
    if(/missing today|missing mirror dates|backup calendar missing|missing today or next/.test(a+' '+b))
      throw new Error('calendar_missing_dates');
    if(/invalid|mismatch|non-increasing|duplicate|impossible/.test(a+' '+b))
      throw new Error('calendar_invalid_response');
    if(/429|too many/.test(a+' '+b))throw new Error('calendar_rate_limited');
    throw new Error('calendar_network_unavailable');
  }finally{clearTimeout(timeout);}
}
