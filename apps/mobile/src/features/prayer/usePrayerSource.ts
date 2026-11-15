import {useCallback,useEffect,useMemo,useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  zonedClock,validateTriplet,validateCachedMirrorTriplet,DEFAULT_MIRROR_PLACE,
  MIRROR_OFFLINE_CACHE_MS,
  type OfficialTriplet,type MirrorTriplet,
} from '@camideyiz/core';
import {
  configuredPrayerApi,getPrayerTriplet,getMirrorPrayerTriplet,
  type PrayerPlaceSelection,
} from './prayerApi';

const OFFICIAL_PLACE_KEY='@camideyiz/official-place/v1';
const MIRROR_PLACE_KEY='@camideyiz/mirror-place/v1';
const OFFICIAL_CACHE_PREFIX='@camideyiz/diyanet-days/v1/';
const MIRROR_CACHE_PREFIX='@camideyiz/idamedya-days/v1/';
type DataStatus=
  'loading'|'choose-location'|'verified'|'offline'|'mirror'|'mirror-cached'|'unavailable';
export type PrayerSourceTriplet=OfficialTriplet|MirrorTriplet;

function validPlace(value:unknown):value is PrayerPlaceSelection{
  if(!value||typeof value!=='object')return false;
  const p=value as PrayerPlaceSelection;
  return Number.isSafeInteger(p.id)&&p.id>0&&p.id<=1_000_000&&
    Number.isSafeInteger(p.stateId)&&p.stateId>0&&p.stateId<=1_000_000&&
    typeof p.name==='string'&&p.name.trim().length>1&&p.name.length<100&&
    typeof p.stateName==='string'&&p.stateName.trim().length>1&&p.stateName.length<100;
}

export function usePrayerSource(now:Date){
  const officialConfigured=configuredPrayerApi();
  const [place,setPlace]=useState<PrayerPlaceSelection|null>(null);
  const [booted,setBooted]=useState(false);
  const [data,setData]=useState<PrayerSourceTriplet|null>(null);
  const [status,setStatus]=useState<DataStatus>('loading');
  const [failureReason,setFailureReason]=useState<string|null>(null);
  const [refresh,setRefresh]=useState(0);
  const dateISO=zonedClock(now,'Europe/Istanbul').dateISO;

  useEffect(()=>{
    let live=true;
    setBooted(false);
    const placeKey=officialConfigured?OFFICIAL_PLACE_KEY:MIRROR_PLACE_KEY;
    AsyncStorage.getItem(placeKey).then(raw=>{
      if(!live)return;
      let stored:PrayerPlaceSelection|null=null;
      try{
        if(raw){
          const saved:unknown=JSON.parse(raw);
          if(validPlace(saved))stored=saved;
        }
      }catch{/* malformed preference does not prevent app boot */}
      // The starter location is *not* inferred from GPS. It is labelled by name.
      setPlace(stored??(officialConfigured?null:{...DEFAULT_MIRROR_PLACE}));
      setBooted(true);
    }).catch(()=>{
      if(live){
        setPlace(officialConfigured?null:{...DEFAULT_MIRROR_PLACE});
        setBooted(true);
      }
    });
    return ()=>{live=false;};
  },[officialConfigured]);

  const selectPlace=useCallback(async(next:PrayerPlaceSelection)=>{
    if(!validPlace(next))throw new Error('Invalid place selection');
    // Persist FIRST. If storage fails the picker remains open with an error;
    // it must not look selected and then silently revert on app restart.
    await AsyncStorage.setItem(
      officialConfigured?OFFICIAL_PLACE_KEY:MIRROR_PLACE_KEY,
      JSON.stringify(next),
    );
    setData(null);
    setStatus('loading');
    setFailureReason(null);
    setPlace(next);
  },[officialConfigured]);
  const retry=useCallback(()=>setRefresh(n=>n+1),[]);
  // Re-check the time-limited third-party cache while the app remains foregrounded.
  useEffect(()=>{
    if(officialConfigured)return;
    const timer=setInterval(()=>setRefresh(value=>value+1),10*60*1000);
    return ()=>clearInterval(timer);
  },[officialConfigured]);
  useEffect(()=>{
    if(!booted)return;
    if(!place){setData(null);setStatus('choose-location');return;}
    let live=true;
    const key=(officialConfigured?OFFICIAL_CACHE_PREFIX:MIRROR_CACHE_PREFIX)+place.id+'/'+dateISO;
    // Keep a still-valid schedule on screen during periodic revalidation.
    // A different district/date/provider or expired mirror data cannot leak through.
    setData(previous=>{
      if(!previous||previous.city.id!==place.id||previous.dateISO!==dateISO||
        previous.source!==(officialConfigured?'diyanet-awqat-salah':'idamedya-diyanet-republished'))return null;
      if(!officialConfigured&&Date.now()-Date.parse(previous.today.fetchedAt)>55*60*1000)return null;
      return previous;
    });
    setStatus('loading');
    setFailureReason(null);
    (async()=>{
      let cached:PrayerSourceTriplet|null=null;
      let olderVerified:PrayerSourceTriplet|null=null;
      try{
        const raw=await AsyncStorage.getItem(key);
        if(raw){
          const value:unknown=JSON.parse(raw);
          if(officialConfigured){
            cached=validateTriplet(value,place.id,dateISO);
          }else{
            try{cached=validateCachedMirrorTriplet(value,place.id,dateISO);}
            catch{
              // Revalidate older published data ONLY for today's same district,
              // and only when both live providers are unreachable.
              olderVerified=validateCachedMirrorTriplet(value,place.id,dateISO,
                Date.now(),MIRROR_OFFLINE_CACHE_MS);
            }
          }
        }
      }catch{/* any corrupted, cross-district or expired cache is ignored */}
      if(!live)return;
      if(cached){
        setData(cached);
        setStatus(officialConfigured?'offline':'mirror-cached');
        // A public cached mirror response can be reused for ~45 minutes.
        // Refresh before 55m expiry, without hitting the upstream on every view.
        if(!officialConfigured&&Date.now()-Date.parse(cached.today.fetchedAt)<45*60*1000)return;
      }
      try{
        const next=officialConfigured
          ?await getPrayerTriplet(place.id,dateISO)
          :await getMirrorPrayerTriplet(place,dateISO);
        if(!live)return;
        setData(next);
        setStatus(officialConfigured?'verified':'mirror');
        setFailureReason(null);
        AsyncStorage.setItem(key,JSON.stringify(next)).catch(()=>undefined);
      }catch(error){
        if(!live)return;
        const reason=error instanceof Error?error.message:'calendar_network_unavailable';
        setFailureReason(reason);
        if(!cached&&olderVerified){
          setData(olderVerified);
          setStatus('mirror-cached');
        }else if(!cached){
          setData(null);setStatus('unavailable');
        }
      }
    })();
    return ()=>{live=false;};
  },[place?.id,dateISO,booted,refresh,officialConfigured]);

  const sourceLabel=officialConfigured
    ?'Diyanet Awqat Salah · resmî API'
    :data?.source==='idamedya-diyanet-republished'
      ?data.provider==='emushaf'
        ?'EzanVakti eMushaf · Diyanet verilerinin bağımsız aktarımı'
        :'İdamedya · Diyanet verilerinin bağımsız aktarımı'
      :'Üçüncü taraf yayımlanmış namaz takvimi';
  return useMemo(()=>({
    place,status,days:data,selectPlace,retry,failureReason,
    configured:true,officialConfigured,sourceLabel,
  }),[place,status,data,selectPlace,retry,failureReason,officialConfigured,sourceLabel]);
}
