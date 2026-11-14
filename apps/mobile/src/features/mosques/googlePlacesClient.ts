import {type GoogleMosque,type GoogleMosqueDetails,validGooglePlaceId,validCoordinates} from '@camideyiz/core';
export type GoogleSearch={places:GoogleMosque[];center:{latitude:number;longitude:number};radius:number;limitedTo:number};
function base():string{
  const value=(process.env.EXPO_PUBLIC_MOSQUE_API_URL??process.env.EXPO_PUBLIC_PRAYER_API_URL??'').trim().replace(/\/+$/,'');
  if(!value)throw new Error('GOOGLE_PLACES_SERVER_NOT_CONFIGURED');
  if(!/^https:\/\//.test(value)&&!(__DEV__&&/^http:\/\/(?:localhost|127\.0\.0\.1|192\.168\.|10\.)/.test(value)))
    throw new Error('GOOGLE_PLACES_SERVER_MUST_BE_HTTPS');
  return value;
}
export function configuredGooglePlaces():boolean{
  try{return !!base();}catch{return false;}
}
async function get(path:string,signal?:AbortSignal):Promise<unknown>{
  const controller=new AbortController(),abort=()=>controller.abort();
  signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>controller.abort(),14500);
  try{
    const response=await fetch(base()+path,{
      method:'GET',signal:controller.signal,
      headers:{'Accept':'application/json','Cache-Control':'no-store'},
    });
    if(!response.ok){
      let code='GOOGLE_PLACES_HTTP_'+response.status;
      try{
        const json=await response.json() as {error?:string};
        if(typeof json.error==='string')code=json.error;
      }catch{/* HTTP status is enough */}
      throw new Error(code);
    }
    return await response.json();
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
export async function searchGoogleMosques(
  lat:number,lon:number,radius:number,query:string,signal?:AbortSignal,
):Promise<GoogleSearch>{
  if(!validCoordinates({latitude:lat,longitude:lon})||!Number.isInteger(radius)||radius<500||radius>10000)
    throw new Error('Invalid search area');
  const path='/api/v1/google-mosques?lat='+lat.toFixed(5)+'&lon='+lon.toFixed(5)+
    '&radius='+radius+(query.trim().length>=2?'&q='+encodeURIComponent(query.trim().slice(0,80)):'');
  const res=await get(path,signal) as GoogleSearch & {source?:string};
  if(res.source!=='google-places'||!Array.isArray(res.places)||res.places.length>20||
    !res.places.every(p=>validGooglePlaceId(p.id)&&validCoordinates(p)&&typeof p.name==='string'))
    throw new Error('Invalid Google Places response');
  return res;
}
export async function getGoogleMosqueDetails(id:string,signal?:AbortSignal):Promise<GoogleMosqueDetails>{
  if(!validGooglePlaceId(id))throw new Error('Invalid Google Place ID');
  const res=await get('/api/v1/google-mosques/'+encodeURIComponent(id),signal) as {
    source?:string;place?:GoogleMosqueDetails;
  };
  if(res.source!=='google-places'||res.place?.id!==id||!validCoordinates(res.place))
    throw new Error('Invalid Google Place details');
  return res.place;
}
export function googleMosquePhotoURL(name:string):string{
  if(!/^places\/[A-Za-z0-9_-]{5,250}\/photos\/[A-Za-z0-9_-]{8,1000}$/.test(name))
    throw new Error('Invalid Google photo resource');
  return base()+'/api/v1/google-mosques/photo?name='+encodeURIComponent(name);
}
