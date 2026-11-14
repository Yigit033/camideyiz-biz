import {useCallback,useEffect,useMemo,useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {zonedClock,validateTriplet,type OfficialTriplet} from '@camideyiz/core';
import {configuredPrayerApi,getPrayerTriplet,type PrayerPlaceSelection} from './prayerApi';

const PLACE_KEY='@camideyiz/official-place/v1';
const CACHE_PREFIX='@camideyiz/diyanet-days/v1/';
type DataStatus='loading'|'choose-location'|'unconfigured'|'verified'|'offline'|'unavailable';
function validPlace(value:unknown):value is PrayerPlaceSelection{
  if(!value||typeof value!=='object')return false;
  const p=value as PrayerPlaceSelection;
  return Number.isSafeInteger(p.id)&&p.id>0&&
    Number.isSafeInteger(p.stateId)&&p.stateId>0&&typeof p.name==='string'&&p.name.length>0&&
    typeof p.stateName==='string'&&p.stateName.length>0;
}
export function usePrayerSource(now:Date){
  const [place,setPlace]=useState<PrayerPlaceSelection|null>(null);
  const [booted,setBooted]=useState(false);
  const [data,setData]=useState<OfficialTriplet|null>(null);
  const [status,setStatus]=useState<DataStatus>('loading');
  const [refresh,setRefresh]=useState(0);
  const dateISO=zonedClock(now,'Europe/Istanbul').dateISO;
  useEffect(()=>{
    let live=true;
    AsyncStorage.getItem(PLACE_KEY).then(raw=>{
      if(!live)return;
      if(raw){
        try{const saved:unknown=JSON.parse(raw);if(validPlace(saved))setPlace(saved);}
        catch{/* ignore corrupt stored preference */}
      }
      setBooted(true);
    }).catch(()=>{if(live)setBooted(true);});
    return ()=>{live=false;};
  },[]);
  const selectPlace=useCallback(async(next:PrayerPlaceSelection)=>{
    if(!validPlace(next))throw new Error('Invalid place selection');
    setData(null);setStatus('loading');setPlace(next);
    await AsyncStorage.setItem(PLACE_KEY,JSON.stringify(next));
  },[]);
  const retry=useCallback(()=>setRefresh(n=>n+1),[]);
  useEffect(()=>{
    if(!booted)return;
    if(!configuredPrayerApi()){setData(null);setStatus('unconfigured');return;}
    if(!place){setData(null);setStatus('choose-location');return;}
    let live=true;
    const key=CACHE_PREFIX+place.id+'/'+dateISO;
    setData(null);setStatus('loading');
    (async()=>{
      let offline:OfficialTriplet|null=null;
      try{
        const text=await AsyncStorage.getItem(key);
        if(text)offline=validateTriplet(JSON.parse(text),place.id,dateISO);
      }catch{/* cached data is untrusted until validated */}
      if(live&&offline){setData(offline);setStatus('offline');}
      try{
        const server=await getPrayerTriplet(place.id,dateISO);
        if(!live)return;
        setData(server);setStatus('verified');
        AsyncStorage.setItem(key,JSON.stringify(server)).catch(()=>undefined);
      }catch{
        if(live&&!offline){setData(null);setStatus('unavailable');}
      }
    })();
    return ()=>{live=false;};
  },[place?.id,dateISO,booted,refresh]);
  return useMemo(()=>({place,status,days:data,selectPlace,retry,configured:configuredPrayerApi()}),
    [place,status,data,selectPlace,retry]);
}
