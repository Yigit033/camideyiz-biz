import {useEffect,useRef,useState} from 'react';
import {AppState} from 'react-native';
import * as Location from 'expo-location';
import {findExactTurkishPlace,locationTravelMeters,prettyTurkishPlace,
  withCentralDistricts} from '@camideyiz/core';
import {getCities,getStates,type PrayerPlaceSelection,
  type CityOption,type StateOption} from './prayerApi';

/** `unlisted`: the phone knows the district, but Diyanet publishes no
 * calendar under that name; the person picks the right one from the list. */
export type DevicePlaceStatus=
  'manual'|'locating'|'active'|'permission-denied'|'unavailable'|'unlisted';
const UNLISTED='district_unlisted';

type GpsFix={latitude:number;longitude:number};
const MIN_MOVEMENT_METERS=2000;
const MAX_LOCATION_ACCURACY_METERS=1200;
const AUTO_RECHECK_MS=8*60_000;

/** Foreground-only, consent-aware Turkish province/district lookup.
 * Crucial: never guess the province capital or adjacent district from an
 * imprecise reverse geocode. Manual selections suspend ALL GPS monitoring.
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

  useEffect(()=>{
    if(!enabled){setStatus('manual');return;}
    let alive=true;
    let watching:Location.LocationSubscription|null=null;
    let inFlight=false;
    let lastGeocode:GpsFix|null=null;
    let lastCheckedAt=0;
    let provinces:StateOption[]|null=null;
    const districts=new Map<number,CityOption[]>();
    setStatus('locating');

    const resolve=async(position:Location.LocationObject)=>{
      if(!alive||inFlight)return;
      const accuracy=position.coords.accuracy;
      if(accuracy!==null&&(!Number.isFinite(accuracy)||
        accuracy>MAX_LOCATION_ACCURACY_METERS)){
        setStatus('unavailable');return;
      }
      const coords:GpsFix={
        latitude:position.coords.latitude,longitude:position.coords.longitude,
      };
      const now=Date.now();
      if(lastGeocode&&
        locationTravelMeters(lastGeocode,coords)<MIN_MOVEMENT_METERS&&
        now-lastCheckedAt<AUTO_RECHECK_MS)return;
      inFlight=true;
      try{
        const address=(await Location.reverseGeocodeAsync(coords))[0];
        if(!alive||!address)throw new Error('No district address');
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
        lastGeocode=coords;
        lastCheckedAt=Date.now();
        setStatus('active');
      }catch(error){
        if(alive){
          // A short outage must not reset the last confirmed district.
          setStatus(error instanceof Error&&error.message===UNLISTED
            ?'unlisted':'unavailable');
        }
      }finally{inFlight=false;}
    };

    const start=async()=>{
      try{
        let permission=await Location.getForegroundPermissionsAsync();
        if(!alive)return;
        if(!permission.granted&&permission.canAskAgain)
          permission=await Location.requestForegroundPermissionsAsync();
        if(!alive)return;
        if(!permission.granted){
          setStatus('permission-denied');return;
        }
        if(!await Location.hasServicesEnabledAsync()){
          if(alive)setStatus('unavailable');
          return;
        }
        // Watcher stops delivering while the app is backgrounded.
        // No Always/background permission, service, or stealth tracking.
        const subscription=await Location.watchPositionAsync({
          accuracy:Location.Accuracy.Balanced,
          timeInterval:60_000,distanceInterval:MIN_MOVEMENT_METERS,
        },position=>{void resolve(position);},
        ()=>{if(alive&&!lastGeocode)setStatus('unavailable');});
        if(!alive){subscription.remove();return;}
        watching=subscription;
        // Also request an immediate fix when the screen is first opened.
        void Location.getCurrentPositionAsync({
          accuracy:Location.Accuracy.Balanced,
        }).then(resolve).catch(()=>{
          if(alive&&!lastGeocode)setStatus('unavailable');
        });
      }catch{if(alive)setStatus('unavailable');}
    };
    void start();
    const foreground=AppState.addEventListener('change',value=>{
      if(!alive||value!=='active')return;
      if(Date.now()-lastCheckedAt<AUTO_RECHECK_MS)return;
      void Location.getForegroundPermissionsAsync().then(permission=>{
        if(!alive||!permission.granted)return;
        return Location.getCurrentPositionAsync({
          accuracy:Location.Accuracy.Balanced,
        }).then(resolve);
      }).catch(()=>{if(alive&&!lastGeocode)setStatus('unavailable');});
    });
    return ()=>{alive=false;watching?.remove();foreground.remove();};
  },[enabled,retry]);
  return status;
}
