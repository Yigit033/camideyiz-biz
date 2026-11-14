import 'server-only';
import {parseDiyanetDay,parseDiyanetList} from '@camideyiz/core';
import {claim,finish,states,city,storeStates,storeCities,storePrayerDays} from './cache';
import {statesOfTurkey,citiesOfState,monthlyDays,awqatGet} from './awqat';

export type SyncMode='states'|'cities'|'monthly'|'weekly';
export async function performSync(mode:SyncMode,id:number|null):
  Promise<{status:'synced'|'skipped';mode:SyncMode;count:number}> {
  if(mode!=='states' && (!Number.isSafeInteger(id)||!id||id<=0||id>99999999))
    throw new Error('Invalid Diyanet sync ID');
  const month=new Intl.DateTimeFormat('sv-SE',{year:'numeric',month:'2-digit',
    timeZone:'Europe/Istanbul'}).format(new Date());
  const key=mode==='states'?'states':mode==='monthly'
    ?'monthly:'+id+':'+month:mode+':'+id;
  const minutes=mode==='states'?43200:mode==='cities'?10080:mode==='monthly'?28800:1320;
  const lease=await claim(key,minutes);
  if(!lease)return {status:'skipped',mode,count:0};
  try{
    let count:number;
    if(mode==='states'){
      const rows=await statesOfTurkey();
      if(!rows.length)throw new Error('Missing official state rows');
      await storeStates(rows);count=rows.length;
    }else if(mode==='cities'){
      const list=await states();
      if(!list.some(x=>x.id===id))throw new Error('Unknown state ID');
      const rows=await citiesOfState(id!);
      if(!rows.length)throw new Error('Missing official city rows');
      await storeCities(rows);count=rows.length;
    }else{
      const place=await city(id!);
      if(!place)throw new Error('Unknown city ID');
      const rows=mode==='monthly'?await monthlyDays(id!,place.name)
        :parseDiyanetList(await awqatGet('/api/PrayerTime/Weekly/'+id!))
          .map(item=>parseDiyanetDay(item,id!,place.name,new Date().toISOString()));
      if(!rows.length||rows.length>35)throw new Error('Invalid prayer dataset');
      await storePrayerDays(rows);count=rows.length;
    }
    await finish(key,lease,true);
    return {status:'synced',mode,count};
  }catch(err){
    await finish(key,lease,false).catch(()=>undefined);
    // No auth tokens, passwords, upstream bodies or private error details are logged.
    throw new Error('Diyanet sync failed');
  }
}
