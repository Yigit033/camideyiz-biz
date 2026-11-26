import {useEffect,useRef,useState} from 'react';
import {AppState,Platform} from 'react-native';
import * as Location from 'expo-location';
import {AUTO_LOCATION,autoLocationRetryDelay,findExactTurkishPlace,
  needsDistrictCheck,prettyTurkishPlace,usableLocationFix,withCentralDistricts,
  type GeoPoint} from '@camideyiz/core';
import {getCities,getStates,type PrayerPlaceSelection,
  type CityOption,type StateOption} from './prayerApi';

/** `unlisted`: the phone knows the district, but Diyanet publishes no
 * calendar under that name; the person picks the right one from the list.
 * `precise-needed`: only approximate location is allowed, which cannot tell
 * neighbouring districts apart. `location-off`: the phone's location is off. */
export type DevicePlaceStatus=
  'manual'|'locating'|'active'|'permission-denied'|'precise-needed'|
  'location-off'|'unavailable'|'unlisted';
const UNLISTED='district_unlisted';

/**
 * Foreground-only, consent-aware Turkish province/district lookup that keeps
 * up with the person: while the app is open every fix after a short walk is
 * looked up (see AUTO_LOCATION), a fix that arrives during a lookup is kept
 * and handled next, and returning to the app checks at once. Never guesses
 * the province capital or an adjacent district from an imprecise reverse
 * geocode. Manual selections suspend ALL GPS monitoring. No background
 * permission, service or tracking: the watcher stops with the app.
 */
export function useDevicePrayerLocation({
  enabled,retry,onResolved,
}:{
  enabled:boolean;retry:number;
  onResolved:(place:PrayerPlaceSelection)=>Promise<void>;
}):DevicePlaceStatus{
  const [status,setStatus]=useState<DevicePlaceStatus>('manual');
  const callback=useRef(onResolved);
  callback.current=onResolved;
  // `retry` grows when the person taps the location button: only then may
  // the system dialogs for precise location or turning location on appear.
  const handledRetry=useRef(retry);

  useEffect(()=>{
    if(!enabled){setStatus('manual');return;}
    const tapped=handledRetry.current!==retry;
    handledRetry.current=retry;
    let alive=true;
    let watching:Location.LocationSubscription|null=null;
    let checking=false;
    let inFlight=false;
    /** The newest fix that arrived while a lookup was running. */
    let pending:Location.LocationObject|null=null;
    let newest=0;
    /** Where the shown district was last confirmed, and what it was. */
    let confirmedAt:GeoPoint|null=null;
    let resolved:'active'|'unlisted'|null=null;
    /** A fix was too vague: the next one-off fix asks the GPS itself. */
    let precise=false;
    let failures=0;
    let retryTimer:ReturnType<typeof setTimeout>|null=null;
    let provinces:StateOption[]|null=null;
    const districts=new Map<number,CityOption[]>();
    const settle=(next:DevicePlaceStatus)=>{if(alive)setStatus(next);};
    setStatus('locating');

    const stopWatching=()=>{watching?.remove();watching=null;};
    const retryLater=()=>{
      if(!alive||retryTimer)return;
      retryTimer=setTimeout(()=>{retryTimer=null;void currentFix();},
        autoLocationRetryDelay(failures++));
    };
    /** A short outage never drops the district already shown. */
    const failed=()=>{
      if(!resolved)settle('unavailable');
      retryLater();
    };

    const lookup=async(position:Location.LocationObject):Promise<void>=>{
      if(!alive)return;
      if(inFlight){
        if(!pending||position.timestamp>=pending.timestamp)pending=position;
        return;
      }
      if(position.timestamp<newest)return;
      newest=position.timestamp;
      if(!usableLocationFix(position.coords.accuracy)){
        precise=true;failed();return;
      }
      const coords:GeoPoint={
        latitude:position.coords.latitude,longitude:position.coords.longitude,
      };
      if(!needsDistrictCheck(confirmedAt,coords))return;
      inFlight=true;
      try{
        const address=(await Location.reverseGeocodeAsync(coords))[0];
        if(!alive)return;
        if(!address)throw new Error('No district address');
        const country=String(address.isoCountryCode??'').toUpperCase();
        if(country&&country!=='TR')throw new Error('Outside Turkish district directory');
        if(!provinces)provinces=await getStates();
        if(!alive)return;
        const province=findExactTurkishPlace(
          [address.region,address.city,address.subregion],provinces);
        if(!province)throw new Error('Province not resolved');
        let allDistricts=districts.get(province.id);
        if(!allDistricts){
          allDistricts=await getCities(province.id);
          districts.set(province.id,allDistricts);
        }
        if(!alive)return;
        // An address may report an Istanbul neighbourhood as "district".
        // Exact matching deliberately avoids false neighbouring-city clocks.
        // Central districts (Üsküdar, Çankaya…) resolve to the province-centre
        // calendar Diyanet publishes for them, under their own name.
        const district=findExactTurkishPlace(
          [address.subregion,address.district,address.city],
          withCentralDistricts(province.name,allDistricts,{gps:true}));
        if(!district||district.state_id!==province.id)
          throw new Error(UNLISTED);
        const centre=district.name==='Merkez';
        await callback.current({
          id:district.id,
          name:prettyTurkishPlace(centre?province.name:district.name),
          stateId:province.id,stateName:prettyTurkishPlace(province.name),
        });
        if(!alive)return;
        confirmedAt=coords;resolved='active';precise=false;failures=0;
        settle('active');
      }catch(error){
        if(!alive)return;
        if(error instanceof Error&&error.message===UNLISTED){
          // No calendar under this name: keep the shown one, let the person
          // pick, and look again only after they move on.
          confirmedAt=coords;resolved='unlisted';failures=0;
          settle('unlisted');
        }else failed();
      }finally{
        inFlight=false;
        const next=pending;pending=null;
        if(next&&alive)void lookup(next);
      }
    };

    const currentFix=async()=>{
      if(!alive)return;
      try{
        await lookup(await Location.getCurrentPositionAsync({
          accuracy:precise?Location.Accuracy.High:Location.Accuracy.Balanced,
        }));
      }catch{
        if(!alive)return;
        // Location switched off meanwhile: say so instead of retrying.
        const on=await Location.hasServicesEnabledAsync().catch(()=>true);
        if(!alive)return;
        if(!on){stopWatching();settle('location-off');return;}
        failed();
      }
    };

    /** Permission → precise → location on → watch, then an immediate fix.
     * Runs on start and every time the app comes back to the front. */
    const start=async(interactive:boolean)=>{
      if(!alive||checking)return;
      checking=true;
      try{
        let permission=await Location.getForegroundPermissionsAsync();
        if(!alive)return;
        if(!permission.granted&&permission.canAskAgain&&interactive)
          permission=await Location.requestForegroundPermissionsAsync();
        if(!alive)return;
        if(!permission.granted){stopWatching();settle('permission-denied');return;}
        if(Platform.OS==='android'&&permission.android?.accuracy==='coarse'){
          // Android 12+ offers "precise" on a repeated request.
          if(tapped&&interactive&&permission.canAskAgain)
            permission=await Location.requestForegroundPermissionsAsync();
          if(!alive)return;
          if(permission.android?.accuracy!=='fine'){
            stopWatching();settle('precise-needed');return;
          }
        }
        if(!await Location.hasServicesEnabledAsync()){
          // The system "turn on location" sheet, only after a tap.
          if(tapped&&interactive&&Platform.OS==='android')
            await Location.enableNetworkProviderAsync().catch(()=>undefined);
          if(!alive)return;
          if(!await Location.hasServicesEnabledAsync()){
            stopWatching();settle('location-off');return;
          }
        }
        if(!alive)return;
        settle(resolved??'locating');
        if(!watching){
          const subscription=await Location.watchPositionAsync({
            accuracy:Location.Accuracy.Balanced,
            timeInterval:AUTO_LOCATION.watchIntervalMs,
            distanceInterval:AUTO_LOCATION.watchDistanceMeters,
          },position=>{void lookup(position);},
          ()=>{if(alive&&!resolved)settle('unavailable');});
          if(!alive){subscription.remove();return;}
          watching=subscription;
        }
        // At once: the phone's own recent fix, then a fresh one.
        const known=await Location.getLastKnownPositionAsync({
          maxAge:AUTO_LOCATION.lastKnownMaxAgeMs,
          requiredAccuracy:AUTO_LOCATION.maxAccuracyMeters,
        }).catch(()=>null);
        if(known&&alive)void lookup(known);
        void currentFix();
      }catch{
        if(alive&&!resolved)settle('unavailable');
      }finally{checking=false;}
    };
    void start(true);
    const foreground=AppState.addEventListener('change',state=>{
      if(alive&&state==='active')void start(false);
    });
    return ()=>{
      alive=false;stopWatching();foreground.remove();
      if(retryTimer)clearTimeout(retryTimer);
    };
  },[enabled,retry]);
  return status;
}
