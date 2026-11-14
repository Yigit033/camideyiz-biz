import {validGooglePlaceId,validCoordinates, type GoogleMosqueDetails} from '@camideyiz/core';
import {googlePlacesKey,allowPlacesRequest} from '@/lib/googleQuota';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const ROOT='https://places.googleapis.com/v1/places/';
const MASK='id,displayName,location,formattedAddress,primaryType,types,googleMapsUri,nationalPhoneNumber,websiteUri,regularOpeningHours,accessibilityOptions,photos';
function text(value:unknown,max=320):string|null {
  return typeof value==='string'&&value.length>0&&value.length<=max?value:null;
}
function safeURL(value:unknown):string|null{
  const v=text(value,450);
  if(!v)return null;
  try{
    const u=new URL(v);
    return u.protocol==='https:'&&!u.username&&!u.password?u.toString():null;
  }catch{return null;}
}
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  if(!validGooglePlaceId(id))return Response.json({error:'invalid_place_id'},{status:400});
  const key=googlePlacesKey();
  if(!key)return Response.json({error:'google_places_not_configured'},{status:503});
  if(!allowPlacesRequest(request,3))return Response.json({error:'query_rate_limited'},{status:429});
  try{
    const response=await fetch(ROOT+encodeURIComponent(id),{
      cache:'no-store',signal:AbortSignal.timeout(11000),
      headers:{'X-Goog-Api-Key':key,'X-Goog-FieldMask':MASK,'Accept-Language':'tr'},
    });
    if(!response.ok)return Response.json({error:'google_place_unavailable'},{status:502});
    const raw=await response.json() as {
      id?:string;displayName?:{text?:string};location?:{latitude?:number;longitude?:number};
      formattedAddress?:string;primaryType?:string;types?:string[];googleMapsUri?:string;
      nationalPhoneNumber?:string;websiteUri?:string;
      regularOpeningHours?:{weekdayDescriptions?:string[]};
      accessibilityOptions?:{wheelchairAccessibleEntrance?:boolean};
      photos?:Array<{name?:string;authorAttributions?:Array<{displayName?:string;uri?:string}>}>;
    };
    if(raw.id!==id||!raw.displayName?.text||
       typeof raw.location?.latitude!=='number'||typeof raw.location?.longitude!=='number'||
       !validCoordinates({latitude:raw.location.latitude,longitude:raw.location.longitude})||
       !(raw.primaryType==='mosque'||raw.types?.includes('mosque'))) {
      return Response.json({error:'not_a_mosque'},{status:404});
    }
    const photos=(raw.photos??[]).slice(0,5).filter(p=>typeof p.name==='string'&&
      p.name.startsWith('places/'+id+'/photos/')).map(p=>({
      name:p.name!,
      attributions:(p.authorAttributions??[]).map(a=>({
        displayName:text(a.displayName,100)??'Katkıda bulunan',
        uri:text(a.uri,320),
      })),
    }));
    const place:GoogleMosqueDetails={
      id,name:raw.displayName.text.slice(0,180),
      latitude:raw.location.latitude,longitude:raw.location.longitude,
      address:text(raw.formattedAddress),primaryType:text(raw.primaryType,70),
      distanceMeters:0,
      phone:text(raw.nationalPhoneNumber,80),
      website:safeURL(raw.websiteUri),
      googleMapsUri:safeURL(raw.googleMapsUri),
      accessibleEntrance:typeof raw.accessibilityOptions?.wheelchairAccessibleEntrance==='boolean'
        ?raw.accessibilityOptions.wheelchairAccessibleEntrance:null,
      openingHours:Array.isArray(raw.regularOpeningHours?.weekdayDescriptions)
        ?raw.regularOpeningHours.weekdayDescriptions.slice(0,7):null,
      photos,
    };
    return Response.json({source:'google-places',place},
      {headers:{'Cache-Control':'private, no-store'}});
  }catch{
    return Response.json({error:'google_place_unavailable'},{status:503,
      headers:{'Cache-Control':'private, no-store'}});
  }
}
