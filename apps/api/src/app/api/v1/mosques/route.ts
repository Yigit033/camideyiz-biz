import {buildOverpassQuery,parseOverpassMosques,type Coordinate} from '@camideyiz/core';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=30;

type Entry={at:number;elements:unknown[]};
const CACHE=new Map<string,Entry>();
const PENDING=new Map<string,Promise<Entry>>();
const TTL=12*60*60*1000;
let lastFetch=0;
function numberParam(value:string|null,min:number,max:number):number|null{
  if(value===null||!/^-?\d{1,3}(?:\.\d{1,8})?$/.test(value))return null;
  const n=Number(value);
  return Number.isFinite(n)&&n>=min&&n<=max?n:null;
}
function error(status:number,code:string){
  return Response.json({error:code},{status,headers:{'Cache-Control':'no-store'}});
}
async function upstream(center:Coordinate,radius:number,signal:AbortSignal):Promise<Entry>{
  const endpoint=process.env.MOSQUE_OVERPASS_ENDPOINT??'https://overpass-api.de/api/interpreter';
  if(!/^https:\/\//.test(endpoint))throw new Error('Invalid OSM provider URL');
  const response=await fetch(endpoint,{
    method:'POST',signal,cache:'no-store',
    headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8',
      'User-Agent':'CamideyizBiz/0.2 (+https://github.com/Yigit033/camideyiz-biz)'},
    body:'data='+encodeURIComponent(buildOverpassQuery(center,radius)),
  });
  if(!response.ok)throw new Error('OSM_UPSTREAM_'+response.status);
  const raw:unknown=await response.json();
  if(!raw||typeof raw!=='object'||!Array.isArray((raw as {elements?:unknown[]}).elements))
    throw new Error('Invalid OSM payload');
  parseOverpassMosques(raw,center);
  return {at:Date.now(),elements:(raw as {elements:unknown[]}).elements};
}
export async function GET(request:Request){
  const u=new URL(request.url);
  const lat=numberParam(u.searchParams.get('lat'),-90,90);
  const lon=numberParam(u.searchParams.get('lon'),-180,180);
  const radius=numberParam(u.searchParams.get('radius'),500,5000);
  if(lat===null||lon===null||radius===null||!Number.isInteger(radius))
    return error(400,'invalid_map_area');
  const center:Coordinate={latitude:lat,longitude:lon};
  const key=(Math.round(lat*250)/250).toFixed(3)+':'+
    (Math.round(lon*250)/250).toFixed(3)+':'+radius;
  let entry=CACHE.get(key);
  if(entry&&Date.now()-entry.at<TTL)
    return Response.json({source:'openstreetmap',elements:entry.elements,
      fetchedAt:new Date(entry.at).toISOString()},
      {headers:{'Cache-Control':'public, s-maxage=3600, stale-while-revalidate=7200'}});
  if(!PENDING.has(key)){
    if(Date.now()-lastFetch<2400)return error(429,'provider_query_cooldown');
    lastFetch=Date.now();
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),24000);
    const pending=upstream(center,radius,controller.signal).finally(()=>{
      clearTimeout(timer);PENDING.delete(key);
    });
    PENDING.set(key,pending);
  }
  try{
    entry=await PENDING.get(key)!;
    CACHE.set(key,entry);
    if(CACHE.size>64){
      const oldest=[...CACHE.entries()].sort((a,b)=>a[1].at-b[1].at)[0]?.[0];
      if(oldest)CACHE.delete(oldest);
    }
    return Response.json({source:'openstreetmap',elements:entry.elements,
      fetchedAt:new Date(entry.at).toISOString()},
      {headers:{'Cache-Control':'public, s-maxage=3600, stale-while-revalidate=7200'}});
  }catch{
    if(entry&&Date.now()-entry.at<7*24*60*60*1000)
      return Response.json({source:'openstreetmap',elements:entry.elements,stale:true,
        fetchedAt:new Date(entry.at).toISOString()},{headers:{'Cache-Control':'no-store'}});
    return error(503,'mosque_provider_unavailable');
  }
}
