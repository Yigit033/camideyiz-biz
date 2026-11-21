import {validateTriplet,type OfficialTriplet,parseMirrorStates,parseMirrorCities,parseBackupDiyanetStates,parseBackupDiyanetCities,parseMirrorTriplet,parseEmushafTriplet,type MirrorTriplet} from '@camideyiz/core';

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
  try{return parseMirrorStates(await mirrorGet('/iller',5500));}
  catch{/* The province directory also needs a reliable fallback for GPS. */}
  for(const base of ['https://namazvakti.mtopal.dev','https://ezanvakti.emushaf.net']){
    try{
      return parseBackupDiyanetStates(
        await publishedGet(base,'/sehirler/2',7000));
    }catch{/* Try next independently hosted directory. */}
  }
  throw new Error('province_directory_unavailable');
}
// All three open directory publishers use the same Diyanet numeric region
// IDs. Directory-only fallback must not change the user's selected province.
const BACKUP_DIRECTORY='https://ezanvakti.emushaf.net';
const VERIFIED_DIRECTORY='https://namazvakti.mtopal.dev';
async function publishedGet(root:string,path:string,timeoutMs=8000):Promise<unknown>{
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const result=await fetch(root+path,{
      method:'GET',headers:{Accept:'application/json'},signal:controller.signal,
    });
    if(!result.ok)throw new Error('Published provider HTTP '+result.status);
    return await result.json();
  }finally{clearTimeout(timeout);}
}
export async function getMirrorCities(stateId:number):Promise<CityOption[]>{
  if(!Number.isSafeInteger(stateId)||stateId<=0)throw new Error('Invalid province');
  try{
    const result=parseMirrorCities(await mirrorGet('/ilceler/'+stateId,4500),stateId);
    if(result.length)return result;
  }catch{/* Try separately operated Diyanet code directories. */}
  for(const root of [VERIFIED_DIRECTORY,BACKUP_DIRECTORY]){
    try{
      const parsed=parseBackupDiyanetCities(
        await publishedGet(root,'/ilceler/'+stateId,6000),stateId);
      if(parsed.length)return parsed;
    }catch{/* Next independent directory. */}
  }
  throw new Error('district_directory_unavailable');
}

/** Published Diyanet district code, never city centre substitution. Two
 * independent sources: Idamedya first, emushaf if the request or the strict
 * parsing/identity/date checks fail. Never calculate or invent prayer hours. */
export async function getMirrorPrayerTriplet(
  place:PrayerPlaceSelection,dateISO:string,
):Promise<MirrorTriplet>{
  if(!Number.isSafeInteger(place.id)||place.id<=0||place.id>1_000_000)
    throw new Error('invalid_district');
  const errors:string[]=[];
  try{
    const raw=await mirrorGet('/'+place.id,6000);
    return parseMirrorTriplet(raw,place.id,dateISO,place.name,new Date().toISOString());
  }catch(e){errors.push(e instanceof Error?e.message:'primary unavailable');}

  // mtopal has independently confirmed HTTP 200 for /vakitler/9551
  // whereas Idamedya returned 503 for 9551 and 9545, and emushaf 403.
  // Use only the selected Diyanet district ID, never a provincial stand-in.
  const alternates=[
    {root:VERIFIED_DIRECTORY,provider:'mtopal' as const},
    {root:BACKUP_DIRECTORY,provider:'emushaf' as const},
  ];
  for(const candidate of alternates){
    try{
      const raw=await publishedGet(candidate.root,'/vakitler/'+place.id,7500);
      return parseEmushafTriplet(raw,place.id,dateISO,
        place.name,new Date().toISOString(),candidate.provider);
    }catch(error){errors.push(error instanceof Error?error.message:'backup unavailable');}
  }
  // No invented or stale timetable: surface a safe reason and retry.
  const explanation=errors.join(' ').toLowerCase();
  if(/missing today|missing published dates|backup calendar missing/.test(explanation))
    throw new Error('calendar_missing_dates');
  if(/invalid|mismatch|non-increasing|duplicate|impossible/.test(explanation))
    throw new Error('calendar_invalid_response');
  if(/429|too many/.test(explanation))throw new Error('calendar_rate_limited');
  throw new Error('calendar_network_unavailable');
}
