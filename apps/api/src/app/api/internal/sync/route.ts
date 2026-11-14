import {isSyncAuthorized,publicError,idNumber} from '@/lib/security';
import {claim,finish,states,cities,city,storeStates,storeCities,storePrayerDays} from '@/lib/cache';
import {statesOfTurkey,citiesOfState,monthlyDays} from '@/lib/awqat';
import {parseDiyanetDay,parseDiyanetList} from '@camideyiz/core';
import {awqatGet} from '@/lib/awqat';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=120;

// Called only by approved, secret-bearing administrative schedules. Never from mobile.
export async function POST(request:Request){
  if(!isSyncAuthorized(request))return publicError('unauthorized',401);
  let body:unknown;
  try{body=await request.json();}
  catch{return publicError('invalid_json',400);}
  if(!body||typeof body!=='object'||Array.isArray(body))return publicError('invalid_request',400);
  const input=body as {mode?:unknown;stateId?:unknown;cityId?:unknown};
  const mode=input.mode;
  if(mode!=='states'&&mode!=='cities'&&mode!=='monthly'&&mode!=='weekly')return publicError('invalid_mode',400);
  const id=mode==='cities'?idNumber(String(input.stateId??'')):
    mode==='states'?null:idNumber(String(input.cityId??''));
  if(mode!=='states'&&id===null)return publicError('invalid_id',400);
  const key=mode==='states'?'states':mode+':'+id;
  const minimumMinutes=mode==='states'?30*24*60:mode==='cities'?7*24*60:mode==='monthly'?20*24*60:22*60;
  let lease:string|null;
  try{lease=await claim(key,minimumMinutes);}
  catch{return publicError('sync_cache_unavailable',503);}
  if(!lease)return Response.json({status:'skipped',reason:'already_cached_or_in_progress'},
    {headers:{'Cache-Control':'no-store'}});
  try{
    let count:number;
    if(mode==='states'){
      const rows=await statesOfTurkey();
      await storeStates(rows);count=rows.length;
    }else if(mode==='cities'){
      const list=await states();
      if(!list.some(s=>s.id===id))throw new Error('Unknown state');
      const rows=await citiesOfState(id!);
      if(rows.length===0)throw new Error('No cities returned');
      await storeCities(rows);count=rows.length;
    }else{
      const place=await city(id!);
      if(!place)throw new Error('Unknown city');
      const rows=mode==='monthly'
        ?await monthlyDays(id!,place.name)
        :parseDiyanetList(await awqatGet('/api/PrayerTime/Weekly/'+id!))
          .map(item=>parseDiyanetDay(item,id!,place.name,new Date().toISOString()));
      if(rows.length===0||rows.length>35)throw new Error('No valid prayer rows');
      await storePrayerDays(rows);count=rows.length;
    }
    await finish(key,lease,true);
    return Response.json({status:'synced',mode,count},
      {headers:{'Cache-Control':'no-store'}});
  }catch{
    await finish(key,lease,false).catch(()=>undefined);
    return publicError('sync_failed_check_server_logs_and_diyanet_access',502);
  }
}
