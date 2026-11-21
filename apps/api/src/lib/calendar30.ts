import 'server-only';
import {db} from './supabase';
import {city} from './cache';
import {parseCalendar30Source,shiftCalendarDate,type Calendar30Snapshot} from '@camideyiz/core';

/** Public, read-only, district-scoped 30-day window over our EXISTING
 * Diyanet-synced Postgres cache. No extra Diyanet requests or credentials.
 */
export async function officialCalendar30(cityId:number,startISO:string):Promise<Calendar30Snapshot|null>{
  const place=await city(cityId);
  if(!place)return null;
  const end=shiftCalendarDate(startISO,29);
  type Row={
    city_id:number;day:string;times:unknown;source:string;timezone:string;
    source_fetched_at:string;hijri_date:string|null;
  };
  const rows=await db<Row[]>('diyanet_prayer_days?select=city_id,day,times,source,timezone,source_fetched_at,hijri_date&city_id=eq.'
    +cityId+'&day=gte.'+startISO+'&day=lte.'+end+'&order=day.asc&limit=30');
  const now=new Date().toISOString();
  const valid=rows.map(row=>{
    const age=Date.now()-Date.parse(row.source_fetched_at);
    if(row.city_id!==cityId||row.source!=='diyanet-awqat-salah'||
      row.timezone!=='Europe/Istanbul'||!Number.isFinite(age)||age< -60_000||
      age>92*86_400_000)throw new Error('Invalid or expired published Diyanet row');
    return {dateISO:row.day,cityId,source:row.source,timezone:row.timezone,
      times:row.times,hijriDate:row.hijri_date};
  });
  if(!valid.length)return null;
  return parseCalendar30Source(valid,'diyanet-awqat-salah',cityId,startISO,now);
}
