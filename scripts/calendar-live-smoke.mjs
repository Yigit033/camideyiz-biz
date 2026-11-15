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
  let source='idamedya',firstError='';
  try{
    const response=await getJson(primary+'/'+region.id);
    const t=parseMirrorTriplet(response,region.id,dateISO,region.name,started);
    return {region:region.name,source,success:true,
      today:t.today.dateISO,imsak:t.today.times[0].time,
      tomorrow:t.next.dateISO};
  }catch(error){firstError=error instanceof Error?error.message:'unknown';}
  try{
    source='emushaf';
    const response=await getJson(backup+'/'+region.id);
    const t=parseEmushafTriplet(response,region.id,dateISO,region.name,started);
    return {region:region.name,source,success:true,
      today:t.today.dateISO,imsak:t.today.times[0].time,
      tomorrow:t.next.dateISO,primaryError:firstError};
  }catch(error){
    return {region:region.name,success:false,
      primaryError:firstError,
      backupError:error instanceof Error?error.message:'unknown'};
  }
};
const results=await Promise.all(regions.map(probe));
for(const result of results)console.log(JSON.stringify(result));
const failed=results.filter(r=>!r.success);
if(failed.length){
  // Diagnostics only; do not ship or claim a provider until its real
  // response shape, legality, district identity and update cycle are verified.
  const candidateURLs=[
    'https://namazvakti.mtopal.dev/vakitler/9551',
    'https://apiservisim.vercel.app/api/namaz?ulke=TR&sehir=istanbul&ilce=tuzla&yil=2026&gun=3',
    'https://namazvakitleri.diyanet.gov.tr/tr-TR/9551/tuzla-icin-namaz-vakti',
    'https://namazvakitleri.diyanet.gov.tr/tr-TR/9740/tarsus-icin-namaz-vakti',
  ];
  const checks=await Promise.all(candidateURLs.map(async url=>{
    try{
      const result=await fetch(url,{signal:AbortSignal.timeout(9000),
        method:'GET',headers:{Accept:'application/json, text/html'}});
      const body=await result.text();
      return {url,status:result.status,contentType:result.headers.get('content-type'),
        length:body.length,preview:body.slice(0,100).replace(/\\s+/g,' ')};
    }catch(err){return {url,error:err instanceof Error?err.message:'unknown'};}
  }));
  for(const item of checks)console.log('ALTERNATIVE_PROBE '+JSON.stringify(item));
}
if(failed.length)throw Error('No verified calendar from either provider for: '+
  failed.map(x=>x.region).join(', '));
