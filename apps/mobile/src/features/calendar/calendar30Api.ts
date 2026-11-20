import {parseCalendar30Source,mergeCalendar30,
  type Calendar30Snapshot,type Calendar30Provider} from '@camideyiz/core';
import {configuredPrayerApi,type PrayerPlaceSelection} from '@/features/prayer/prayerApi';

const SOURCES:readonly {root:string;provider:Calendar30Provider;path:(id:number)=>string;timeout:number}[]=[
  {root:'https://namazvakti.mtopal.dev',provider:'mtopal',
    path:id=>'/vakitler/'+id,timeout:8000},
  {root:'https://idamedya.org',provider:'idamedya',
    path:id=>'/api/v1/namaz/'+id,timeout:6500},
  {root:'https://ezanvakti.emushaf.net',provider:'emushaf',
    path:id=>'/vakitler/'+id,timeout:6500},
];
async function request(url:string,ms:number,signal?:AbortSignal):Promise<unknown>{
  const abort=new AbortController();
  const timer=setTimeout(()=>abort.abort(),ms);
  const forward=()=>abort.abort();
  signal?.addEventListener('abort',forward,{once:true});
  try{
    if(signal?.aborted)throw new Error('Calendar request cancelled');
    const result=await fetch(url,{headers:{Accept:'application/json'},signal:abort.signal});
    if(!result.ok)throw new Error('Published calendar HTTP '+result.status);
    return result.json();
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',forward);}
}
export async function fetchCalendar30(place:PrayerPlaceSelection,dateISO:string,
  signal?:AbortSignal):Promise<Calendar30Snapshot>{
  const cityId=place.id;
  if(!Number.isSafeInteger(cityId)||cityId<=0||cityId>1_000_000)
    throw new Error('Invalid selected district');
  if(configuredPrayerApi()){
    const root=process.env.EXPO_PUBLIC_PRAYER_API_URL?.trim().replace(/\/+$/,'');
    if(!root||!/^https:\/\//.test(root))throw new Error('Secure official calendar API required');
    const raw=await request(root+'/api/v1/calendar30?cityId='+cityId+
      '&date='+encodeURIComponent(dateISO),9000,signal);
    // The read-only API is from the configured server; validate every
    // returned row and the selected district before displaying anything.
    const value=raw as Calendar30Snapshot;
    if(!value||value.cityId!==cityId||value.startISO!==dateISO||
      !Array.isArray(value.days)||value.days.length!==30)
      throw new Error('Official calendar identity mismatch');
    const present=value.days.filter((v):v is NonNullable<typeof v>=>v!==null).map(day=>({
      dateISO:day.dateISO,cityId:day.cityId,source:'diyanet-awqat-salah',
      timezone:'Europe/Istanbul',times:day.times,hijriDate:day.hijriDate,
    }));
    if(!present.length)throw new Error('Official calendar has no published days');
    return parseCalendar30Source(present,'diyanet-awqat-salah',cityId,dateISO,
      typeof value.fetchedAt==='string'?value.fetchedAt:new Date().toISOString());
  }
  const snapshots:Calendar30Snapshot[]=[];
  const failures:string[]=[];
  // Use one publisher per actual day. Try the next provider only if there
  // are still missing dates; never send 30 individual requests.
  for(const entry of SOURCES){
    if(signal?.aborted)throw new Error('Calendar request cancelled');
    try{
      const raw=await request(entry.root+entry.path(cityId),entry.timeout,signal);
      const snapshot=parseCalendar30Source(raw,entry.provider,cityId,dateISO,
        new Date().toISOString());
      snapshots.push(snapshot);
      if(mergeCalendar30(snapshots).days.every(Boolean))break;
    }catch(error){failures.push(error instanceof Error?error.message:String(error));}
  }
  if(!snapshots.length)throw new Error('Yayımlanmış takvim alınamadı. '+failures.join('; ').slice(0,180));
  return mergeCalendar30(snapshots);
}
