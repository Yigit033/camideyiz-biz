import {triplet} from '@/lib/cache';
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
  // Limit unauthenticated users to a practical date window.
  const time=Date.parse(date+'T12:00:00Z');
  if(Math.abs(time-Date.now())>1000*60*60*24*32)return publicError('date_out_of_range',400);
  try{
    const data=await triplet(cityId,date);
    if(!data)return publicError('verified_schedule_not_available',404);
    return Response.json({source:'diyanet-awqat-salah',dateISO:date,
      city:data.city,previous:data.days[0],today:data.days[1],next:data.days[2]},
      {headers:{'Cache-Control':'public, s-maxage=600, stale-while-revalidate=1200'}});
  }catch{return publicError('verified_schedule_unavailable',503);}
}
