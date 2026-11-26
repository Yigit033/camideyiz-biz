import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  zonedClock,validateTriplet,validateCachedMirrorTriplet,
  MIRROR_OFFLINE_CACHE_MS,
  type OfficialTriplet,type MirrorTriplet,
} from '@camideyiz/core';
import {
  configuredPrayerApi,getPrayerTriplet,getMirrorPrayerTriplet,
  type PrayerPlaceSelection,
} from './prayerApi';
import {useDevicePrayerLocation} from './useDevicePrayerLocation';
import {markStartup,recordStartupOperation} from '@/features/performance/startupMetrics';

const OFFICIAL_PLACE_KEY='@camideyiz/official-place/v1';
const MIRROR_PLACE_KEY='@camideyiz/mirror-place/v1';
const OFFICIAL_CACHE_PREFIX='@camideyiz/diyanet-days/v1/';
const MIRROR_CACHE_PREFIX='@camideyiz/idamedya-days/v1/';
const PLACE_MODE_KEY='@camideyiz/location-selection-mode/v1';
export type PrayerPlaceMode='auto'|'manual';
type DataStatus=
  'loading'|'choose-location'|'verified'|'offline'|'mirror'|'mirror-cached'|'unavailable';
export type PrayerSourceTriplet=OfficialTriplet|MirrorTriplet;

/** Central districts share their province-centre calendar ID, so a day
 * cached as "İstanbul" can be shown for "Üsküdar". Every day carries the
 * selected district's name: the widget cache, widgets and notifications
 * read it from there. */
function labelledFor(data:PrayerSourceTriplet|null,place:PrayerPlaceSelection|null):
PrayerSourceTriplet|null{
  if(!data||!place||data.city.id!==place.id)return data;
  const name=place.name;
  if(data.city.name===name&&data.today.locationName===name&&
     data.next.locationName===name)return data;
  const day=<T extends {locationName:string}>(value:T):T=>
    value.locationName===name?value:{...value,locationName:name};
  return data.source==='idamedya-diyanet-republished'
    ?{...data,city:{...data.city,name},
      previous:data.previous?day(data.previous):null,
      upcoming:data.upcoming.map(day),today:day(data.today),next:day(data.next)}
    :{...data,city:{...data.city,name},
      previous:day(data.previous),today:day(data.today),next:day(data.next)};
}
/** Same published calendar: only the shown district name differs. */
function sameCalendar(a:PrayerPlaceSelection|null,b:PrayerPlaceSelection):boolean{
  return a!==null&&a.id===b.id&&a.stateId===b.stateId;
}

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
  const [locationMode,setLocationMode]=useState<PrayerPlaceMode|'booting'>('booting');
  const modeRef=useRef<PrayerPlaceMode|'booting'>('booting');
  const currentPlaceRef=useRef<PrayerPlaceSelection|null>(null);
  const [locationRetry,setLocationRetry]=useState(0);
  const [booted,setBooted]=useState(false);
  const [data,setData]=useState<PrayerSourceTriplet|null>(null);
  const [status,setStatus]=useState<DataStatus>('loading');
  const [failureReason,setFailureReason]=useState<string|null>(null);
  const [refresh,setRefresh]=useState(0);
  const dateISO=zonedClock(now,'Europe/Istanbul').dateISO;
  currentPlaceRef.current=place;

  useEffect(()=>{
    let live=true;
    setBooted(false);
    const placeKey=officialConfigured?OFFICIAL_PLACE_KEY:MIRROR_PLACE_KEY;
    AsyncStorage.multiGet([placeKey,PLACE_MODE_KEY]).then(records=>{
      if(!live)return;
      let stored:PrayerPlaceSelection|null=null;
      try{
        const raw=records[0]?.[1];
        if(raw){
          const saved:unknown=JSON.parse(raw);
          if(validPlace(saved))stored=saved;
        }
      }catch{/* Corrupted preferences are not a GPS result. */}
      // Preserve existing explicit selections on upgrade; fresh installs
      // start with GPS, not a pretend default Istanbul location.
      const selected:PrayerPlaceMode=records[1]?.[1]==='auto'
        ?'auto'
        :records[1]?.[1]==='manual'||stored
          ?'manual':'auto';
      modeRef.current=selected;
      setLocationMode(selected);
      currentPlaceRef.current=stored;
      setPlace(stored);
      setBooted(true);
    }).catch(()=>{
      if(live){
        modeRef.current='auto';setLocationMode('auto');
        setPlace(null);setBooted(true);
      }
    });
    return ()=>{live=false;};
  },[officialConfigured]);

  const selectPlace=useCallback(async(next:PrayerPlaceSelection)=>{
    if(!validPlace(next))throw new Error('Invalid place selection');
    // Manual selection is an explicit persistent override. Position watches
    // are unmounted when mode changes and may never silently override it.
    await AsyncStorage.multiSet([
      [officialConfigured?OFFICIAL_PLACE_KEY:MIRROR_PLACE_KEY,
        JSON.stringify(next)],
      [PLACE_MODE_KEY,'manual'],
    ]);
    modeRef.current='manual';
    setLocationMode('manual');
    // Üsküdar after İstanbul (same calendar): keep the shown hours; the
    // calendar effect only reloads for a different district ID.
    const reload=!sameCalendar(currentPlaceRef.current,next);
    currentPlaceRef.current=next;
    if(reload){setData(null);setStatus('loading');setFailureReason(null);}
    setPlace(next);
  },[officialConfigured]);

  const selectGpsPlace=useCallback(async(next:PrayerPlaceSelection)=>{
    if(!validPlace(next)||modeRef.current!=='auto')return;
    const current=currentPlaceRef.current;
    const reload=!sameCalendar(current,next);
    if(!reload&&current?.name===next.name&&current?.stateName===next.stateName)return;
    const key=officialConfigured?OFFICIAL_PLACE_KEY:MIRROR_PLACE_KEY;
    await AsyncStorage.setItem(key,JSON.stringify(next));
    if(modeRef.current!=='auto')return;
    currentPlaceRef.current=next;
    if(reload){setData(null);setStatus('loading');setFailureReason(null);}
    setPlace(next);
  },[officialConfigured]);

  const enableAutoLocation=useCallback(async()=>{
    // Called by the explicit crosshair on the home location header.
    await AsyncStorage.setItem(PLACE_MODE_KEY,'auto');
    modeRef.current='auto';
    setLocationMode('auto');
    setLocationRetry(value=>value+1);
  },[]);
  const autoLocationStatus=useDevicePrayerLocation({
    enabled:booted&&locationMode==='auto',
    retry:locationRetry,onResolved:selectGpsPlace,
  });
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
    // Stale-while-revalidate: previously PUBLISHED hours for this exact
    // district/day stay visible while network requests proceed. Never invent
    // or recalculate times from a phone clock. Up to 24h of validated offline
    // coverage is already enforced by the core mirror cache validator.
    let carried:PrayerSourceTriplet|null=null;
    if(data&&data.city.id===place.id&&data.dateISO===dateISO&&
       data.source===(officialConfigured?'diyanet-awqat-salah':'idamedya-diyanet-republished')){
      try{
        carried=officialConfigured
          ?validateTriplet(data,place.id,dateISO)
          :validateCachedMirrorTriplet(data,place.id,dateISO,
            Date.now(),MIRROR_OFFLINE_CACHE_MS);
      }catch{/* A different date, district or expired data is never reused. */}
    }
    setData(carried);
    setStatus(carried?(officialConfigured?'offline':'mirror-cached'):'loading');
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
        markStartup('published-cache-ready');
        setData(cached);
        setStatus(officialConfigured?'offline':'mirror-cached');
        // A public cached mirror response can be reused for ~45 minutes.
        // Refresh before 55m expiry, without hitting the upstream on every view.
        if(!officialConfigured&&Date.now()-Date.parse(cached.today.fetchedAt)<45*60*1000)return;
      }else if(olderVerified){
        markStartup('published-cache-ready');
        // Critical cold-start fix: show already verified, same-date published
        // hours immediately. The mirror network can otherwise take 5–10 sec.
        // Home checks the 24-hour offline validity independently.
        setData(olderVerified);
        setStatus('mirror-cached');
      }
      const networkStartedAt=Date.now();
      try{
        const next=officialConfigured
          ?await getPrayerTriplet(place.id,dateISO)
          :await getMirrorPrayerTriplet(place,dateISO);
        if(!live)return;
        markStartup('published-network-ready');
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
      }finally{
        recordStartupOperation('published-network-fetch',networkStartedAt);
      }
    })();
    return ()=>{live=false;};
  },[place?.id,dateISO,booted,refresh,officialConfigured]);

  const sourceLabel=officialConfigured
    ?'Diyanet Awqat Salah · resmî API'
    :data?.source==='idamedya-diyanet-republished'
      ?data.provider==='mtopal'
        ?'Namaz Vakti API (mtopal.dev) · Diyanet verilerinin bağımsız aktarımı'
        :data.provider==='emushaf'
          ?'EzanVakti eMushaf · Diyanet verilerinin bağımsız aktarımı'
          :'İdamedya · Diyanet verilerinin bağımsız aktarımı'
      :'Üçüncü taraf yayımlanmış namaz takvimi';
  const days=useMemo(()=>labelledFor(data,place),[data,place]);
  return useMemo(()=>({
    place,status,days,selectPlace,retry,failureReason,
    locationMode,autoLocationStatus,enableAutoLocation,
    configured:true,officialConfigured,sourceLabel,
  }),[place,status,days,selectPlace,retry,failureReason,locationMode,
    autoLocationStatus,enableAutoLocation,officialConfigured,sourceLabel]);
}
