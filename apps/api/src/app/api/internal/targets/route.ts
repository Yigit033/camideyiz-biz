import {isSyncAuthorized,publicError,idNumber} from '@/lib/security';
import {city} from '@/lib/cache';
import {db} from '@/lib/supabase';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
  if(!isSyncAuthorized(request))return publicError('unauthorized',401);
  let input:unknown;
  try{input=await request.json();}catch{return publicError('invalid_json',400);}
  if(!input||typeof input!=='object'||Array.isArray(input))return publicError('invalid_body',400);
  const body=input as {cityId?:unknown;enabled?:unknown};
  const id=idNumber(String(body.cityId??''));
  if(!id||typeof body.enabled!=='boolean')return publicError('invalid_target',400);
  try{
    if(!await city(id))return publicError('unknown_city',404);
    await db('diyanet_sync_targets?on_conflict=city_id',{
      method:'POST',prefer:'resolution=merge-duplicates,return=minimal',
      body:{city_id:id,enabled:body.enabled},
    });
    return Response.json({status:'saved',cityId:id,enabled:body.enabled},
      {headers:{'Cache-Control':'no-store'}});
  }catch{return publicError('target_update_failed',503);}
}
