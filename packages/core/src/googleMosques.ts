import {distanceMeters,validCoordinates,type Coordinate} from './mosques.ts';

/** Google Places content remains in ephemeral application memory only.
 * Persisting Google Place IDs as favorites is permitted; place details are refetched.
 */
export type GoogleMosque = {
  id:string;name:string;latitude:number;longitude:number;
  address:string|null;distanceMeters:number;primaryType:string|null;
};
export type GoogleMosqueDetails = GoogleMosque & {
  phone:string|null;website:string|null;googleMapsUri:string|null;
  accessibleEntrance:boolean|null;openingHours:string[]|null;
  photos:Array<{name:string;attributions:Array<{displayName:string;uri:string|null}>}>;
};
export const GOOGLE_PLACES_MAX_RESULTS=20;
export function validGooglePlaceId(id:unknown):id is string{
  return typeof id==='string'&&id.length>=5&&id.length<=250&&/^[\w-]+$/.test(id);
}
function obj(value:unknown):Record<string,unknown>|null {
  return !!value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
}
function txt(value:unknown,max=220):string|null {
  return typeof value==='string'&&value.trim().length>0&&value.length<=max?value.trim():null;
}
export function parseGoogleMosques(value:unknown,center:Coordinate):GoogleMosque[]{
  if(!validCoordinates(center))throw new RangeError('Invalid center');
  const wrapper=obj(value);
  if(!wrapper||!Array.isArray(wrapper.places))throw new Error('Invalid Google Places envelope');
  if(wrapper.places.length>GOOGLE_PLACES_MAX_RESULTS)throw new Error('Too many Google results');
  const ids=new Set<string>(),results:GoogleMosque[]=[];
  for(const raw of wrapper.places){
    const row=obj(raw);
    if(!row||!validGooglePlaceId(row.id)||ids.has(row.id))continue;
    const loc=obj(row.location),display=obj(row.displayName);
    const lat=loc?.latitude,lon=loc?.longitude;
    const name=txt(display?.text,180);
    if(typeof lat!=='number'||typeof lon!=='number'||!name||
      !validCoordinates({latitude:lat,longitude:lon}))continue;
    const types=Array.isArray(row.types)?row.types:[];
    if(row.primaryType!=='mosque'&&!types.includes('mosque'))continue;
    ids.add(row.id);
    results.push({id:row.id,name,latitude:lat,longitude:lon,
      address:txt(row.formattedAddress,300),
      distanceMeters:distanceMeters(center,{latitude:lat,longitude:lon}),
      primaryType:txt(row.primaryType,70)});
  }
  return results.sort((a,b)=>a.distanceMeters-b.distanceMeters||a.name.localeCompare(b.name,'tr'));
}
export function googleMapsPlaceURL(id:string):string {
  if(!validGooglePlaceId(id))throw new Error('Invalid place ID');
  return 'https://www.google.com/maps/search/?api=1&query=mosque&query_place_id='+encodeURIComponent(id);
}
export function googleWalkingDirectionsURL(place:Pick<GoogleMosque,'id'|'latitude'|'longitude'>):string {
  if(!validGooglePlaceId(place.id)||!validCoordinates(place))throw new Error('Invalid destination');
  return 'https://www.google.com/maps/dir/?api=1&destination='+place.latitude.toFixed(6)+
    ','+place.longitude.toFixed(6)+'&destination_place_id='+encodeURIComponent(place.id)+
    '&travelmode=walking';
}
export function googleSearchRadius(latitudeDelta:number):number{
  if(!Number.isFinite(latitudeDelta)||latitudeDelta<=0)throw new RangeError('Invalid region');
  // Bounds deliberately capped to keep calls predictable and discoverability understandable.
  return Math.max(700,Math.min(10000,Math.round(latitudeDelta*111320*.65)));
}
export function visibleGoogleMatches(places:readonly GoogleMosque[],query:string,favorites:ReadonlySet<string>):GoogleMosque[]{
  const q=query.trim().toLocaleLowerCase('tr-TR');
  return places.filter(p=>(!q||(p.name+' '+(p.address??'')).toLocaleLowerCase('tr-TR').includes(q))&&
    (!favorites||favorites.size>=0));
}
