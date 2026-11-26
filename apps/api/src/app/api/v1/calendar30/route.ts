import {officialCalendar30} from '@/lib/calendar30';
import {idNumber,publicError} from '@/lib/security';
import {assertISODate} from '@camideyiz/core';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  const params=new URL(request.url).searchParams;
  const cityId=idNumber(params.get('cityId'));
  if(!cityId)return publicError('invalid_city_id',400);
  let date:string;
  try{date=assertISODate(params.get('date')??'');}
  catch{return publicError('invalid_date',400);}
  // Identical public rate/temporal guard to existing prayer-times endpoint.
  const at=Date.parse(date+'T12:00:00Z');
  if(Math.abs(at-Date.now())>32*86_400_000)return publicError('date_out_of_range',400);
  try{
    const snapshot=await officialCalendar30(cityId,date);
    if(!snapshot)return publicError('published_calendar_not_available',404);
    return Response.json(snapshot,{
      headers:{'Cache-Control':'public, s-maxage=600, stale-while-revalidate=900'}});
  }catch{return publicError('published_calendar_unavailable',503);}
}
