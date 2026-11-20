import {useCallback,useEffect,useMemo,useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {validateCalendar30Cache,calendar30Coverage,
  type Calendar30Snapshot} from '@camideyiz/core';
import {fetchCalendar30} from './calendar30Api';
import {useSharedPrayerSource} from '@/features/prayer/PrayerSourceProvider';

const PREFIX='@camideyiz/calendar30/v1/';
type CalendarState='choose-location'|'loading'|'available'|'partial'|'unavailable';
export function useCalendar30(dateISO:string){
  const {place,days}=useSharedPrayerSource();
  const [snapshot,setSnapshot]=useState<Calendar30Snapshot|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [revision,setRevision]=useState(0);
  const retry=useCallback(()=>setRevision(x=>x+1),[]);
  const id=place?.id;
  useEffect(()=>{
    if(!place||!id){setSnapshot(null);setLoading(false);return;}
    const controller=new AbortController();
    let active=true;
    // Explicit refresh must not blank the last validated snapshot.
    // A different district/date always resets to prevent mixed locations.
    if(revision===0)setSnapshot(null);
    setError(null);setLoading(true);
    const key=PREFIX+id+'/'+dateISO;
    (async()=>{
      // Use exact-district, exact-start cache only, not previous location.
      let cached:Calendar30Snapshot|null=null;
      if(revision===0)try{
        const raw=await AsyncStorage.getItem(key);
        if(raw)cached=validateCalendar30Cache(JSON.parse(raw),id,dateISO,Date.now());
      }catch{/* an expired/corrupt cache is never published */}
      if(!active)return;
      if(cached){setSnapshot(cached);setLoading(false);return;}
      try{
        const current=await fetchCalendar30(place,dateISO,controller.signal);
        if(!active)return;
        setSnapshot(current);
        AsyncStorage.setItem(key,JSON.stringify(current)).catch(()=>undefined);
      }catch(e){
        if(active)setError(e instanceof Error?e.message:'Takvim bağlantısı kurulamadı.');
      }finally{if(active)setLoading(false);}
    })();
    return ()=>{active=false;controller.abort();};
  },[id,dateISO,revision,place?.name]);
  const coverage=snapshot?calendar30Coverage(snapshot):0;
  const status:CalendarState=!place?'choose-location':loading&&!snapshot?'loading':
    snapshot?(coverage===30?'available':'partial'):'unavailable';
  // Date and location are never fabricated from a different triplet; this is
  // a read-only feature and does not mutate provider or notification state.
  const today=useMemo(()=>days?.today?.dateISO===dateISO?days.today:null,
    [days?.today,dateISO]);
  return {place,snapshot,coverage,status,loading,error,retry,today};
}
