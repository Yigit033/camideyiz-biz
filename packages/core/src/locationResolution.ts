/** Exact Turkish province/district resolution for opt-in device GPS.
 * Never choose a neighbouring/centre district via fuzzy substring matches.
 * Reverse-geocoder labels can contain "İlçesi" and ASCII transliterations.
 */
export function normaliseTurkishPlace(value:string):string{
  return value.trim().toLocaleLowerCase('tr-TR')
    .replace(/ı/g,'i').replace(/ğ/g,'g').replace(/ü/g,'u')
    .replace(/ş/g,'s').replace(/ö/g,'o').replace(/ç/g,'c')
    .replace(/\b(?:province|district|ilcesi|ilce|ili|il)\b/gi,'')
    .replace(/[^a-z0-9]+/g,' ').trim();
}
export type LocationDirectoryRow={id:number;name:string};
export function findExactTurkishPlace<T extends LocationDirectoryRow>(
  candidateNames:readonly (string|null|undefined)[],
  entries:readonly T[],
):T|null{
  for(const label of candidateNames){
    if(typeof label!=='string'||label.length<2)continue;
    const normalized=normaliseTurkishPlace(label);
    if(!normalized)continue;
    const matches=entries.filter(entry=>normaliseTurkishPlace(entry.name)===normalized);
    if(matches.length===1)return matches[0];
  }
  return null;
}

/** Approximate Haversine distance; ONLY a threshold for reducing Android
 * geocoder and network queries, never used to infer a prayer district.
 */
export function locationTravelMeters(
  a:{latitude:number;longitude:number},
  b:{latitude:number;longitude:number},
):number{
  const {latitude:lat1,longitude:lon1}=a;
  const {latitude:lat2,longitude:lon2}=b;
  if(![lat1,lon1,lat2,lon2].every(Number.isFinite)||
    Math.abs(lat1)>90||Math.abs(lat2)>90||
    Math.abs(lon1)>180||Math.abs(lon2)>180)
    throw new RangeError('Invalid coordinates');
  const dLat=(lat2-lat1)*Math.PI/180;
  const dLon=(lon2-lon1)*Math.PI/180;
  const rad1=lat1*Math.PI/180,rad2=lat2*Math.PI/180;
  const aVal=Math.sin(dLat/2)**2+
    Math.cos(rad1)*Math.cos(rad2)*Math.sin(dLon/2)**2;
  return 12742000*Math.asin(Math.min(1,Math.sqrt(Math.max(0,aVal))));
}
