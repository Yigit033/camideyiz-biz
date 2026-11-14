import {parseGoogleMosques,type Coordinate} from '@camideyiz/core';
import {googlePlacesKey,allowPlacesRequest} from '@/lib/googleQuota';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=25;

const ENDPOINT='https://places.googleapis.com/v1';
const FIELD_MASK='places.id,places.displayName,places.location,places.formattedAddress,places.types,places.primaryType';
function responseError(status:number,error:string) {
  return Response.json({error},{status,headers:{'Cache-Control':'private, no-store'}});
}
function pointParam(raw:string|null,min:number,max:number):number|null {
  if(!raw||!/^-?\d{1,3}(?:\.\d{1,7})?$/.test(raw))return null;
  const value=Number(raw);return Number.isFinite(value)&&value>=min&&value<=max?value:null;
}
export async function GET(request:Request){
  const params=new URL(request.url).searchParams;
  const latitude=pointParam(params.get('lat'),-90,90),longitude=pointParam(params.get('lon'),-180,180);
  const radius=pointParam(params.get('radius'),500,10000);
  if(latitude===null||longitude===null||radius===null||!Number.isInteger(radius))
    return responseError(400,'invalid_map_region');
  const query=params.get('q')?.trim()??'';
  if(query.length>80||/[<>]/.test(query))return responseError(400,'invalid_query');
  const key=googlePlacesKey();
  if(!key)return responseError(503,'google_places_not_configured');
  if(!allowPlacesRequest(request,2))return responseError(429,'query_rate_limited');
  const center:Coordinate={latitude,longitude};
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),11000);
  try{
    const isText=query.length>=2;
    const endpoint=isText?'places:searchText':'places:searchNearby';
    const body=isText?{
      textQuery:query+' cami',includedType:'mosque',strictTypeFiltering:true,
      maxResultCount:20,languageCode:'tr',regionCode:'TR',
      locationBias:{circle:{center,radius}},
    }:{
      includedTypes:['mosque'],maxResultCount:20,rankPreference:'DISTANCE',
      languageCode:'tr',regionCode:'TR',
      locationRestriction:{circle:{center,radius}},
    };
    const resp=await fetch(ENDPOINT+'/'+endpoint,{
      method:'POST',signal:controller.signal,cache:'no-store',
      headers:{
        'Content-Type':'application/json','X-Goog-Api-Key':key,
        'X-Goog-FieldMask':FIELD_MASK,
      },
      body:JSON.stringify(body),
    });
    if(resp.status===429)return responseError(429,'provider_quota');
    if(!resp.ok)return responseError(502,'google_places_request_failed');
    const data:unknown=await resp.json();
    const all=parseGoogleMosques(data,center);
    // No place data is saved in a server or device database; Google Places
    // Terms prohibit prefetching and caching beyond permitted exceptions.
    return Response.json({source:'google-places',center,
      radius,limitedTo:20,places:all},
      {headers:{'Cache-Control':'private, no-store'}});
  }catch{return responseError(503,'google_places_unavailable');}
  finally{clearTimeout(timer);}
}
