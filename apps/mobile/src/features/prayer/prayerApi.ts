import {validateTriplet,type OfficialTriplet} from '@camideyiz/core';

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
  const r=await request('/api/v1/states');
  if(!r||typeof r!=='object'||!Array.isArray((r as {states?:unknown}).states))throw new Error('Invalid state directory');
  return (r as {states:StateOption[]}).states.filter(x=>Number.isSafeInteger(x.id)&&x.id>0&&typeof x.name==='string');
}
export async function getCities(stateId:number):Promise<CityOption[]> {
  const r=await request('/api/v1/cities?stateId='+stateId);
  if(!r||typeof r!=='object'||!Array.isArray((r as {cities?:unknown}).cities))throw new Error('Invalid city directory');
  return (r as {cities:CityOption[]}).cities.filter(x=>Number.isSafeInteger(x.id)&&x.id>0&&
    x.state_id===stateId&&typeof x.name==='string');
}
export async function getPrayerTriplet(cityId:number,dateISO:string):Promise<OfficialTriplet>{
  const raw=await request('/api/v1/prayer-times?cityId='+cityId+'&date='+encodeURIComponent(dateISO));
  return validateTriplet(raw,cityId,dateISO);
}
