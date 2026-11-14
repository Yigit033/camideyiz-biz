/** Pure OSM mosque discovery model. Does not fabricate amenities or ownership. */
export type MosqueAccess = 'yes'|'limited'|'no'|null;
export type MosqueRecord = {
  id:string; osmType:'node'|'way'|'relation';osmId:number;
  name:string;latitude:number;longitude:number;distanceMeters:number;
  address:string|null;wheelchair:MosqueAccess;ablution:boolean|null;womenArea:boolean|null;
  phone:string|null;website:string|null;openingHours:string|null;
  commonsFile:string|null;description:string|null;
};
export type MosqueFilter='all'|'favorites'|'photographed'|'accessible';
export type Coordinate={latitude:number;longitude:number};
export const ISTANBUL_CENTER:Coordinate={latitude:41.0082,longitude:28.9784};
export const MOSQUE_RADIUS_METERS=3500;
const OSM_TYPES=new Set(['node','way','relation']);
const MAX_RECORDS=240;
function isRecord(value:unknown):value is Record<string,unknown>{
  return !!value&&typeof value==='object'&&!Array.isArray(value);
}
function string(value:unknown,max=200):string|null{
  return typeof value==='string'&&value.trim().length>0&&value.length<=max?value.trim():null;
}
export function validCoordinates(point:Coordinate):boolean{
  return Number.isFinite(point.latitude)&&Number.isFinite(point.longitude)&&
    point.latitude>=-90&&point.latitude<=90&&point.longitude>=-180&&point.longitude<=180;
}
export function distanceMeters(a:Coordinate,b:Coordinate):number{
  if(!validCoordinates(a)||!validCoordinates(b))throw new RangeError('Invalid map coordinate');
  const toRad=Math.PI/180,dy=(b.latitude-a.latitude)*toRad,dx=(b.longitude-a.longitude)*toRad;
  const h=Math.sin(dy/2)**2+Math.cos(a.latitude*toRad)*Math.cos(b.latitude*toRad)*Math.sin(dx/2)**2;
  return 6371000*2*Math.asin(Math.min(1,Math.sqrt(h)));
}
export function formatMosqueDistance(meters:number):string{
  if(!Number.isFinite(meters)||meters<0)throw new RangeError('Invalid distance');
  return meters<1000?Math.round(meters)+' m':(meters/1000).toLocaleString('tr-TR',{maximumFractionDigits:1})+' km';
}
export function buildOverpassQuery(center:Coordinate,radius= MOSQUE_RADIUS_METERS):string{
  if(!validCoordinates(center))throw new RangeError('Invalid search center');
  if(!Number.isInteger(radius)||radius<500||radius>5000)throw new RangeError('Search radius must be 500..5000m');
  const lat=center.latitude.toFixed(5),lon=center.longitude.toFixed(5);
  return '[out:json][timeout:20];('+
    'nwr(around:'+radius+','+lat+','+lon+')['+'"amenity"="place_of_worship"'+']['+'"religion"="muslim"'+'];'+
    'nwr(around:'+radius+','+lat+','+lon+')['+'"building"="mosque"'+'];'+
    ');out center tags;';
}
export function commonsTitle(value:unknown):string|null{
  const raw=string(value,350);
  if(!raw)return null;
  let name=raw;
  if(/^https?:\/\//i.test(name)&&!/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/i.test(name))return null;
  if(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/i.test(name)){
    name=decodeURIComponent(name.split('/wiki/')[1]);
  }
  name=name.replace(/^File:/i,'').replace(/_/g,' ');
  if(!/\.(?:jpg|jpeg|png|webp)$/i.test(name)||/[<>\n\r#?\/\\]/.test(name)||name.length>220)
    return null;
  return 'File:'+name;
}
function supportTag(raw:unknown):MosqueAccess{
  return raw==='yes'||raw==='limited'||raw==='no'?raw:null;
}
function booleanTag(raw:unknown):boolean|null{
  if(raw==='yes'||raw==='designated')return true;
  if(raw==='no')return false;
  return null;
}
function normalized(text:string):string{
  return text.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/ı/g,'i').replace(/[^a-z0-9]+/g,' ').trim();
}
function addressOf(tags:Record<string,unknown>):string|null{
  const street=string(tags['addr:street'],120),house=string(tags['addr:housenumber'],24);
  const district=string(tags['addr:district']??tags['addr:suburb']??tags['addr:neighbourhood'],90);
  const city=string(tags['addr:city'],90);
  const address=string(tags['addr:full'],180);
  if(address)return address;
  const pieces=[street?[street,house].filter(Boolean).join(' '):null,district,city].filter(Boolean);
  return pieces.length?Array.from(new Set(pieces)).join(', '):null;
}
function safeWebsite(value:unknown):string|null{
  const raw=string(value,400);
  if(!raw)return null;
  try{
    const u=new URL(raw);
    return (u.protocol==='https:'||u.protocol==='http:')&&!u.username&&!u.password?u.toString():null;
  }catch{return null;}
}
function parseOSM(raw:unknown,origin:Coordinate):MosqueRecord|null{
  if(!isRecord(raw))return null;
  const type=raw.type;
  const id=raw.id;
  if(typeof type!=='string'||!OSM_TYPES.has(type)||typeof id!=='number'||!Number.isSafeInteger(id)||id<=0)return null;
  const tags:Record<string,unknown>=isRecord(raw.tags)?raw.tags:{};
  const worship=tags.amenity==='place_of_worship'&&tags.religion==='muslim';
  const mosqueBuilding=tags.building==='mosque';
  if(!worship&&!mosqueBuilding)return null;
  const geom=isRecord(raw.center)?raw.center:raw;
  const latitude=Number(geom.lat),longitude=Number(geom.lon);
  if(!validCoordinates({latitude,longitude}))return null;
  const name=string(tags['name:tr']??tags.name,160)??'Adı belirtilmemiş cami';
  const base:Coordinate={latitude,longitude};
  const phone=string(tags['contact:phone']??tags.phone,70);
  return {
    id:type+'/'+id,osmType:type as MosqueRecord['osmType'],osmId:Number(id),
    name,latitude,longitude,distanceMeters:distanceMeters(origin,base),
    address:addressOf(tags),wheelchair:supportTag(tags.wheelchair),
    ablution:booleanTag(tags.ablution??tags['toilets:ablution']),
    womenArea:booleanTag(tags['female:prayer_room']??tags['prayer_room:female']),
    phone:phone&&/^\+?[\d ()-]{7,}$/.test(phone)?phone:null,
    website:safeWebsite(tags['contact:website']??tags.website),
    openingHours:string(tags.opening_hours,140),
    commonsFile:commonsTitle(tags.wikimedia_commons??tags.image),
    description:string(tags.description,240),
  };
}
function moreComplete(r:MosqueRecord):number {
  return (r.commonsFile?8:0)+(r.address?3:0)+(r.phone?2:0)+(r.website?2:0)+
    (r.osmType!=='node'?2:0)+(r.wheelchair?1:0);
}
export function parseOverpassMosques(raw:unknown,origin:Coordinate):MosqueRecord[]{
  if(!validCoordinates(origin)||!isRecord(raw)||!Array.isArray(raw.elements))
    throw new Error('Invalid OSM mosque response');
  if(raw.elements.length>12000)throw new Error('Unexpectedly large OSM response');
  const all=raw.elements.map(item=>parseOSM(item,origin))
    .filter((x):x is MosqueRecord=>x!==null);
  const seen=new Set<string>();
  const unique:MosqueRecord[]=[];
  // O(n) average near-neighbour dedup; the old unique.some loop was O(n²)
  // and blocked the mobile JS thread on dense parts of İstanbul.
  const buckets=new Map<string,MosqueRecord[]>();
  const scale=0.0003; // ~33m latitude; neighbouring buckets cover the 35m threshold.
  const key=(lat:number,lon:number)=>lat+':'+lon;
  all.sort((a,b)=>moreComplete(b)-moreComplete(a));
  for(const item of all){
    if(seen.has(item.id))continue;
    const x=Math.floor(item.latitude/scale),y=Math.floor(item.longitude/scale);
    const name=normalized(item.name);
    let duplicate=false;
    for(let dx=-2;dx<=2&&!duplicate;dx++){
      for(let dy=-2;dy<=2&&!duplicate;dy++){
        for(const older of buckets.get(key(x+dx,y+dy))??[]){
          if(normalized(older.name)===name && distanceMeters(older,item)<35){
            duplicate=true;break;
          }
        }
      }
    }
    if(duplicate)continue;
    seen.add(item.id);unique.push(item);
    const bucket=key(x,y);
    const peers=buckets.get(bucket)??[];
    peers.push(item);buckets.set(bucket,peers);
  }
  return unique.sort((a,b)=>a.distanceMeters-b.distanceMeters||a.name.localeCompare(b.name,'tr')).slice(0,MAX_RECORDS);
}
export function filterMosques(
  items:readonly MosqueRecord[],query:string,filter:MosqueFilter,favorites:ReadonlySet<string>,
):MosqueRecord[]{
  const needle=normalized(query).slice(0,100);
  return items.filter(item=>{
    if(filter==='favorites'&&!favorites.has(item.id))return false;
    if(filter==='photographed'&&!item.commonsFile)return false;
    if(filter==='accessible'&&item.wheelchair!=='yes'&&item.wheelchair!=='limited')return false;
    return !needle||normalized(item.name+' '+(item.address??'')).includes(needle);
  });
}
export function walkingDirectionsURL(place:Coordinate):string{
  if(!validCoordinates(place))throw new RangeError('Invalid destination');
  return 'https://www.google.com/maps/dir/?api=1&destination='+
    place.latitude.toFixed(6)+','+place.longitude.toFixed(6)+'&travelmode=walking';
}
export function osmDetailURL(item:Pick<MosqueRecord,'osmType'|'osmId'>):string{
  return 'https://www.openstreetmap.org/'+item.osmType+'/'+item.osmId;
}
