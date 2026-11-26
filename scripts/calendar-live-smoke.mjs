/**
 * Published calendar smoke test covering different municipalities.
 * CI records failures but never fabricates prayer hours or blocks TypeScript.
 * Run with: node --experimental-strip-types scripts/calendar-live-smoke.mjs
 */
import {zonedClock} from '../packages/core/src/prayer.ts';
import {parseMirrorTriplet,parseEmushafTriplet,parseMirrorStates}
  from '../packages/core/src/mirrorCalendar.ts';

const dateISO=zonedClock(new Date(),'Europe/Istanbul').dateISO;
const regions=[
  {id:9541,stateId:539,name:'İstanbul',state:'İstanbul'},
  {id:9551,stateId:539,name:'Tuzla',state:'İstanbul'},
  {id:9545,stateId:539,name:'Pendik',state:'İstanbul'},
  {id:9740,stateId:557,name:'Tarsus',state:'Mersin'},
];
const primary='https://idamedya.org/api/v1/namaz';
const backup='https://ezanvakti.emushaf.net/vakitler';
async function getJson(url){
  const result=await fetch(url,{
    method:'GET',headers:{Accept:'application/json'},
    signal:AbortSignal.timeout(8500),
  });
  if(!result.ok)throw new Error('HTTP '+result.status);
  return result.json();
}
let states;
try {
  states=parseMirrorStates(await getJson(primary+'/iller'));
  console.log('Province directory:',states.length,'records');
}catch(error){
  console.warn('Province directory unavailable:',error.message);
}
const probe=async(region)=>{
  const started=new Date().toISOString();
  const attempts=[];
  try{
    const t=parseMirrorTriplet(
      await getJson(primary+'/'+region.id),region.id,dateISO,region.name,started);
    return {region:region.name,source:'idamedya',success:true,
      today:t.today.dateISO,imsak:t.today.times[0].time,
      tomorrow:t.next.dateISO,attempts};
  }catch(error){attempts.push('idamedya:'+
    (error instanceof Error?error.message:'unknown'));}
  for(const source of [
    {name:'mtopal',root:'https://namazvakti.mtopal.dev/vakitler'},
    {name:'emushaf',root:backup},
  ]){
    try{
      const t=parseEmushafTriplet(await getJson(source.root+'/'+region.id),
        region.id,dateISO,region.name,started,source.name);
      return {region:region.name,source:source.name,success:true,
        today:t.today.dateISO,imsak:t.today.times[0].time,
        tomorrow:t.next.dateISO,attempts};
    }catch(error){attempts.push(source.name+':'+
      (error instanceof Error?error.message:'unknown'));}
  }
  return {region:region.name,success:false,attempts};
};
const results=await Promise.all(regions.map(probe));
for(const result of results)console.log(JSON.stringify(result));
const failed=results.filter(r=>!r.success);
if(failed.length)throw Error('No verified calendar from any provider for: '+
  failed.map(x=>x.region).join(', '));
