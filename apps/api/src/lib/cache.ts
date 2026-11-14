import 'server-only';
import {db} from './supabase';
import {assertISODate, type VerifiedPrayerDay, type PublicPlace} from '@camideyiz/core';

type StateRow={id:number;name:string;country_id:number};
type CityRow={id:number;name:string;state_id:number};
type PrayerRow={
  city_id:number;day:string;timezone:string;times:VerifiedPrayerDay['times'];
  source:string;source_fetched_at:string;hijri_date:string|null;
};
export async function states():Promise<StateRow[]>{
  return db<StateRow[]>('diyanet_states?select=id,name,country_id&order=name.asc');
}
export async function cities(stateId:number):Promise<CityRow[]>{
  return db<CityRow[]>('diyanet_cities?select=id,name,state_id&state_id=eq.'+stateId+'&order=name.asc');
}
export async function city(cityId:number):Promise<CityRow|null>{
  const rows=await db<CityRow[]>('diyanet_cities?select=id,name,state_id&id=eq.'+cityId+'&limit=1');
  return rows[0]??null;
}
function adjacent(date:string,days:number):string {
  const time=Date.parse(assertISODate(date)+'T12:00:00Z')+days*86400000;
  return new Date(time).toISOString().slice(0,10);
}
export async function triplet(cityId:number,date:string){
  const start=adjacent(date,-1),end=adjacent(date,1);
  const rows=await db<PrayerRow[]>('diyanet_prayer_days?select=city_id,day,timezone,times,source,source_fetched_at,hijri_date&city_id=eq.'
    +cityId+'&day=gte.'+start+'&day=lte.'+end+'&order=day.asc');
  if(rows.length!==3||rows[0].day!==start||rows[1].day!==date||rows[2].day!==end)return null;
  const place=await city(cityId);
  if(!place)return null;
  const schedule=rows.map(r=>{
    // Cache corruption must not turn into a fictitious official prayer schedule.
    if(r.source!=='diyanet-awqat-salah'||r.timezone!=='Europe/Istanbul'||
      !Array.isArray(r.times)||r.times.length!==6||
      !Number.isFinite(Date.parse(r.source_fetched_at))||
      Date.now()-Date.parse(r.source_fetched_at)>1000*60*60*24*92){
      throw new Error('Cached Diyanet schedule invalid or expired');
    }
    return {cityId:r.city_id,dateISO:r.day,timezone:'Europe/Istanbul',
      times:r.times,locationName:place.name,source:'diyanet-awqat-salah',
      fetchedAt:r.source_fetched_at,hijriDate:r.hijri_date,isDemo:false};
  });
  return {city:place,days:schedule};
}
export async function storeStates(items:Array<{id:number;name:string;countryId:number}>){
  return db<null>('diyanet_states?on_conflict=id',{method:'POST',prefer:'resolution=merge-duplicates,return=minimal',
    body:items.map(i=>({id:i.id,name:i.name,country_id:i.countryId,source_fetched_at:new Date().toISOString()}))});
}
export async function storeCities(items:PublicPlace[]){
  return db<null>('diyanet_cities?on_conflict=id',{method:'POST',prefer:'resolution=merge-duplicates,return=minimal',
    body:items.map(i=>({id:i.id,name:i.name,state_id:i.stateId,source_fetched_at:new Date().toISOString()}))});
}
export async function storePrayerDays(days:VerifiedPrayerDay[]){
  if(days.length===0)return;
  return db<null>('diyanet_prayer_days?on_conflict=city_id,day',{
    method:'POST',prefer:'resolution=merge-duplicates,return=minimal',
    body:days.map(p=>({city_id:p.cityId,day:p.dateISO,timezone:p.timezone,
      times:p.times,hijri_date:p.hijriDate,source:p.source,source_fetched_at:p.fetchedAt})),
  });
}
export async function claim(key:string,minimumMinutes:number){
  return db<string|null>('rpc/claim_diyanet_sync',{method:'POST',body:{p_key:key,p_minimum_minutes:minimumMinutes}});
}
export async function finish(key:string,token:string,success:boolean){
  return db<boolean>('rpc/finish_diyanet_sync',{method:'POST',body:{p_key:key,p_lease:token,p_success:success}});
}
