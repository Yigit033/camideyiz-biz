import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type Coordinate,type MosqueRecord,MOSQUE_RADIUS_METERS,
  parseOverpassMosques,buildOverpassQuery,validCoordinates,
} from '@camideyiz/core';

const CACHE_PREFIX='@camideyiz/mosque-search/v2/';
const INDEX_KEY='@camideyiz/mosque-cache-index/v2';
const FRESH_FOR=12*60*60*1000;
const STALE_LIMIT=7*24*60*60*1000;
const OVERPASS='https://overpass-api.de/api/interpreter';
type Cache={created:number;center:Coordinate;elements:unknown[]};
export type MosqueSearchResult={
  items:MosqueRecord[];fetchedAt:number;source:'cached'|'network'|'stale';center:Coordinate;
};
function cacheKey(center:Coordinate){
  return CACHE_PREFIX+center.latitude.toFixed(2)+':'+center.longitude.toFixed(2);
}
function baseURL(){
  const raw=process.env.EXPO_PUBLIC_MOSQUE_API_URL?.trim() ||
    process.env.EXPO_PUBLIC_PRAYER_API_URL?.trim();
  if(!raw)return null;
  if(!/^https:\/\//i.test(raw)&&!(__DEV__&&/^http:\/\/(?:localhost|127\.0\.0\.1|192\.168\.)/.test(raw)))
    throw new Error('Mosque API must use HTTPS');
  return raw.replace(/\/+$/,'');
}
async function fetchRaw(center:Coordinate,signal:AbortSignal):Promise<unknown>{
  const base=baseURL();
  let response:Response;
  if(base){
    const path='/api/v1/mosques?lat='+center.latitude.toFixed(5)+'&lon='+center.longitude.toFixed(5)+
      '&radius='+MOSQUE_RADIUS_METERS;
    response=await fetch(base+path,{signal,headers:{Accept:'application/json'}});
  }else if(__DEV__){
    // Development-only, low-volume fallback. A production binary needs its own API.
    response=await fetch(OVERPASS,{
      method:'POST',signal,
      headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent':'CamideyizBiz-Development/0.1 (+https://github.com/Yigit033/camideyiz-biz)'},
      body:'data='+encodeURIComponent(buildOverpassQuery(center)),
    });
  }else throw new Error('MOSQUE_API_NOT_CONFIGURED');
  if(response.status===429||response.status===503)throw new Error('MOSQUE_DATA_RATE_LIMIT');
  if(!response.ok)throw new Error('MOSQUE_DATA_HTTP_'+response.status);
  const raw:unknown=await response.json();
  if(!raw||typeof raw!=='object'||!Array.isArray((raw as {elements?:unknown}).elements))
    throw new Error('MOSQUE_DATA_BAD_RESPONSE');
  return raw;
}
async function cached(center:Coordinate):Promise<Cache|null>{
  try{
    const text=await AsyncStorage.getItem(cacheKey(center));
    if(!text)return null;
    const item:Cache=JSON.parse(text);
    if(!Number.isFinite(item.created)||Date.now()-item.created>STALE_LIMIT||
      !validCoordinates(item.center)||!Array.isArray(item.elements))return null;
    // Revalidate every record. Never blindly trust device-cached metadata.
    parseOverpassMosques({elements:item.elements},center);
    return item;
  }catch{return null;}
}
async function save(center:Coordinate,elements:unknown[]){
  try{
    const key=cacheKey(center);
    await AsyncStorage.setItem(key,JSON.stringify({created:Date.now(),center,elements}));
    let keys:string[]=[];
    try{
      const index=await AsyncStorage.getItem(INDEX_KEY);
      if(index){const decoded:unknown=JSON.parse(index);if(Array.isArray(decoded))
        keys=decoded.filter((x):x is string=>typeof x==='string'&&x.startsWith(CACHE_PREFIX));}
    }catch{/* cache index can be replaced */}
    keys=[key,...keys.filter(x=>x!==key)];
    await AsyncStorage.setItem(INDEX_KEY,JSON.stringify(keys.slice(0,10)));
    if(keys.length>10)await AsyncStorage.multiRemove(keys.slice(10));
  }catch{/* storage/quota failure should not hide fresh data */}
}
export async function loadMosques(
  center:Coordinate,{force=false,signal}:{force?:boolean;signal?:AbortSignal}={},
):Promise<MosqueSearchResult>{
  if(!validCoordinates(center))throw new Error('Invalid search region');
  const old=await cached(center);
  if(old&&!force&&Date.now()-old.created<FRESH_FOR){
    return {items:parseOverpassMosques({elements:old.elements},center),
      fetchedAt:old.created,source:'cached',center};
  }
  const controller=new AbortController();
  const abort=()=>controller.abort();
  signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>controller.abort(),24000);
  try{
    const raw=await fetchRaw(center,controller.signal);
    const elements=(raw as {elements:unknown[]}).elements;
    const items=parseOverpassMosques(raw,center);
    await save(center,elements);
    return {items,fetchedAt:Date.now(),source:'network',center};
  }catch(error){
    if(signal?.aborted)throw error;
    if(old)return {items:parseOverpassMosques({elements:old.elements},center),
      fetchedAt:old.created,source:'stale',center};
    throw error;
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
