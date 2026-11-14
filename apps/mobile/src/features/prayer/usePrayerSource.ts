import {useCallback,useEffect,useMemo,useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  zonedClock,validateTriplet,validateCachedMirrorTriplet,DEFAULT_MIRROR_PLACE,
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
    setData(null);setStatus('loading');setPlace(next);
    await AsyncStorage.setItem(officialConfigured?OFFICIAL_PLACE_KEY:MIRROR_PLACE_KEY,JSON.stringify(next));
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
    (async()=>{
      let cached:PrayerSourceTriplet|null=null;
      try{
        const raw=await AsyncStorage.getItem(key);
        if(raw){
          const value:unknown=JSON.parse(raw);
          cached=officialConfigured
            ?validateTriplet(value,place.id,dateISO)
            :validateCachedMirrorTriplet(value,place.id,dateISO);
        }
      }catch{/* any corrupted or expired local data is ignored */}
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
        AsyncStorage.setItem(key,JSON.stringify(next)).catch(()=>undefined);
      }catch{
        if(live&&!cached){setData(null);setStatus('unavailable');}
      }
    })();
    return ()=>{live=false;};
  },[place?.id,dateISO,booted,refresh,officialConfigured]);

  const sourceLabel=officialConfigured
    ?'Diyanet Awqat Salah · resmî API'
    :'İdamedya · Diyanet kaynaklı olduğu belirtilen takvim (üçüncü taraf)';
  return useMemo(()=>({
    place,status,days:data,selectPlace,retry,
    configured:true,officialConfigured,sourceLabel,
  }),[place,status,data,selectPlace,retry,officialConfigured,sourceLabel]);
}
