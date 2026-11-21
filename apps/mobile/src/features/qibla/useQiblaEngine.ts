import {useCallback,useEffect,useRef,useState} from 'react';
import {AppState} from 'react-native';
import {useFocusEffect} from 'expo-router';
import * as Location from 'expo-location';
import {useSharedValue,withTiming,Easing,type SharedValue} from 'react-native-reanimated';
import {
  filterQiblaHeading,headingFreshness,isUsableQiblaFix,qiblaBearing,
  normalizeReportedHeading,qiblaTiltState,magneticInterference,kaabaDistanceKm,
  shortestHeadingDelta,
  QIBLA_POSITION_MAX_ACCURACY_METERS,QIBLA_POSITION_MAX_AGE_MS,
  type HeadingFilter,type HeadingFreshness,type HeadingProfile,
  type MagneticInterference,type QiblaTilt,
} from '@camideyiz/core';
import {nativeCompassAvailable,setNativeCompassLocation,watchNativeCompass,
  type NativeCompassReading} from './nativeCompass';

export type CompassAccuracy=0|1|2|3;
export type PositionSource='fresh'|'last-known'|'none';
export type CompassSource='fused'|'standard'|'none';

const GPS_TIMEOUT_MS=10_000;
const GPS_REFRESH_MS=90_000;
const HEADING_RESUBSCRIBE_MS=9_000;
const HEADING_RETRY_GAP_MS=8_000;
const TEXT_UPDATE_MS=110; // discrete UI text ≤ ~9 Hz; the needle itself is UI-thread
const SENSOR_STATUS_UPDATE_MS=500;

/** A bounded timeout around Expo's native fix. The native request may continue
 * in the OS; Promise.race does NOT cancel it. We never apply a timed-out result.
 */
async function withTimeout<T>(promise:Promise<T>,duration:number):Promise<T>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{
    return await Promise.race([
      promise,
      new Promise<never>((_,reject)=>{
        timer=setTimeout(()=>reject(new Error('LOCATION_TIMEOUT')),duration);
      }),
    ]);
  }finally{
    if(timer!==undefined)clearTimeout(timer);
  }
}

/** Continuous (unwrapped) angle for Reanimated: always the shortest arc, so
 * crossing 359°→1° never spins the needle the long way round. */
function advance(shared:SharedValue<number>,last:{current:number},target:number){
  const previous=last.current;
  let next=previous+shortestHeadingDelta(previous,target);
  if(Math.abs(next)>3600){
    // Re-base by whole turns: jump INVISIBLY to the equivalent angle first,
    // otherwise the animation would spin ten turns back to the wrapped value.
    const turns=Math.trunc(next/360)*360;
    shared.value=previous-turns;
    next-=turns;
  }
  last.current=next;
  shared.value=withTiming(next,{duration:70,easing:Easing.out(Easing.quad)});
}

/** Lifecycle-safe tracking. GPS decides the geodesic direction; the compass
 * decides phone orientation. Their failure states are independent: a sensor
 * interruption must never wipe the last valid coordinate or Qibla bearing.
 *
 * Android uses the fused rotation-vector module (tilt, interference and a
 * real ±° error estimate); iOS/Expo Go use expo-location's heading.
 * No latitude/longitude is written to storage or uploaded.
 */
export function useQiblaEngine(){
  const [bearing,setBearing]=useState<number|null>(null);
  const [heading,setHeading]=useState<number|null>(null);
  const [compassAccuracy,setCompassAccuracy]=useState<CompassAccuracy|null>(null);
  const [freshness,setFreshness]=useState<HeadingFreshness>('stale');
  const [locationAccuracy,setLocationAccuracy]=useState<number|null>(null);
  const [locationLabel,setLocationLabel]=useState('Konum bekleniyor');
  const [distanceKm,setDistanceKm]=useState<number|null>(null);
  const [positionSource,setPositionSource]=useState<PositionSource>('none');
  const [headingEnabled,setHeadingEnabled]=useState(false);
  const [permissionDenied,setPermissionDenied]=useState(false);
  const [busy,setBusy]=useState(false);
  const [cycle,setCycle]=useState(0);
  const [message,setMessage]=useState('Konumuna izin vererek kıble yönünü bulabilirsin.');
  const [tilt,setTilt]=useState<QiblaTilt>('flat');
  const [interference,setInterference]=useState<MagneticInterference>('unknown');
  const [errorDegrees,setErrorDegrees]=useState<number|null>(null);
  const [compassSource,setCompassSource]=useState<CompassSource>('none');

  // UI-thread animation inputs: updated per sensor sample WITHOUT re-rendering.
  const needleAngle=useSharedValue(0);  // Qibla relative to the phone's top edge
  const northAngle=useSharedValue(0);   // device heading (cardinal ring = -heading)
  const lastNeedle=useRef(0);
  const lastNorth=useRef(0);
  const bearingRef=useRef<number|null>(null);

  const mounted=useRef(true);
  const focused=useRef(false);
  const hadPermissionOnce=useRef(false);
  const locationPending=useRef(false);
  const latestFixAt=useRef(0);
  const geocodedAt=useRef(0);
  const geocodeSource=useRef<PositionSource>('none');
  const geocodeSequence=useRef(0);
  const [positionUsable,setPositionUsable]=useState(false);
  const filter=useRef<HeadingFilter|null>(null);
  const lastTextAt=useRef(0);
  const lastStatusAt=useRef(0);
  const interferenceRef=useRef<MagneticInterference>('unknown');

  useEffect(()=>{
    mounted.current=true;
    return()=>{mounted.current=false;};
  },[]);

  const applyPosition=useCallback((fix:Location.LocationObject,source:Exclude<PositionSource,'none'>)=>{
    const now=Date.now();
    const maxAge=source==='fresh'?60_000:QIBLA_POSITION_MAX_AGE_MS;
    if(!isUsableQiblaFix(fix,now,maxAge,QIBLA_POSITION_MAX_ACCURACY_METERS))
      return false;
    let direction:number;
    try{direction=qiblaBearing(fix.coords.latitude,fix.coords.longitude);}
    catch{return false;}
    if(!mounted.current)return false;
    // Declination for the fused compass comes from this very fix.
    setNativeCompassLocation(fix.coords.latitude,fix.coords.longitude,fix.coords.altitude);
    bearingRef.current=direction;
    setBearing(direction);
    try{setDistanceKm(kaabaDistanceKm(fix.coords.latitude,fix.coords.longitude));}
    catch{setDistanceKm(null);}
    setLocationAccuracy(fix.coords.accuracy);
    setPositionSource(source);
    setHeadingEnabled(true);
    latestFixAt.current=source==='fresh'?now:fix.timestamp;
    setPositionUsable(true);
    const geocodeDue=now-geocodedAt.current>90_000 ||
      (source==='fresh'&&geocodeSource.current!=='fresh');
    if(geocodeDue){
      geocodedAt.current=now;
      geocodeSource.current=source;
      const requestSequence=++geocodeSequence.current;
      // Reverse geocoding is presentation only; it never delays compass updates.
      void Location.reverseGeocodeAsync({
        latitude:fix.coords.latitude,longitude:fix.coords.longitude,
      }).then(addresses=>{
        if(!mounted.current||requestSequence!==geocodeSequence.current)return;
        const first=addresses[0];
        const city=first?.city??first?.region??first?.subregion??null;
        const country=first?.country??null;
        setLocationLabel(city?[city,country].filter(Boolean).join(', '):'Konum alındı');
      }).catch(()=>{
        if(mounted.current&&requestSequence===geocodeSequence.current)
          setLocationLabel('Konum alındı');
      });
    }
    return true;
  },[]);

  const requestLocation=useCallback(async(prompt:boolean)=>{
    if(locationPending.current)return;
    locationPending.current=true;
    if(mounted.current)setBusy(true);
    try{
      const permission=prompt?await Location.requestForegroundPermissionsAsync()
        :await Location.getForegroundPermissionsAsync();
      if(!mounted.current)return;
      if(!permission.granted){
        if(prompt||hadPermissionOnce.current){
          setPermissionDenied(true);
          setPositionUsable(false);
          setHeadingEnabled(false);
          setFreshness('stale');
          setMessage('Konum izni kapalı. Güvenli kıble yönü için izin gerekli.');
        }
        return;
      }
      hadPermissionOnce.current=true;
      setPermissionDenied(false);
      // Android's cached fused fix avoids indefinite spinner indoors. It is
      // never silently treated as a new high-precision GPS observation.
      let hadFallback=false;
      try{
        const last=await withTimeout(Location.getLastKnownPositionAsync({
          maxAge:QIBLA_POSITION_MAX_AGE_MS,
          requiredAccuracy:QIBLA_POSITION_MAX_ACCURACY_METERS,
        }),2200);
        if(last&&mounted.current){
          hadFallback=applyPosition(last,'last-known');
          if(hadFallback)setMessage('Son güvenilir konum kullanılıyor. Güncel konum aranıyor.');
        }
      }catch{/* Some Android providers expose no last-known location. */}
      try{
        const fresh=await withTimeout(
          Location.getCurrentPositionAsync({accuracy:Location.Accuracy.High}),
          GPS_TIMEOUT_MS,
        );
        if(!mounted.current)return;
        if(applyPosition(fresh,'fresh')){
          setMessage('Telefonu yere paralel tut ve yavaşça kendi etrafında dön.');
        }else if(hadFallback){
          setMessage('Güncel konum alınamadı; son bilinen konum kullanılıyor.');
        }else{
          setMessage('Güncel konum yeterince güvenilir değil. Açık alanda tekrar dene.');
        }
      }catch{
        if(!mounted.current)return;
        // A previously established geodesic direction remains available.
        setMessage(hadFallback||latestFixAt.current>0
          ?'GPS geçici olarak alınamadı. Son güvenilir konum gösteriliyor.'
          :'Konum alınamadı. Konum servislerini kontrol edip tekrar dene.');
      }
    }catch{
      if(mounted.current)setMessage('Konum servisi kullanılamıyor. Tekrar dene.');
    }finally{
      locationPending.current=false;
      if(mounted.current)setBusy(false);
    }
  },[applyPosition]);

  // Entering the tab never prompts for permissions again. Refresh location
  // opportunistically while preserving the previously computed Kaaba bearing.
  useFocusEffect(useCallback(()=>{
    focused.current=true;
    if(Date.now()-latestFixAt.current>=GPS_REFRESH_MS){
      void Location.getForegroundPermissionsAsync().then(p=>{
        if(!focused.current)return;
        if(p.granted)void requestLocation(false);
        else if(hadPermissionOnce.current){
          setPositionUsable(false);
          setHeadingEnabled(false);
          setPermissionDenied(true);
          setFreshness('stale');
        }
      }).catch(()=>undefined);
    }
    return()=>{focused.current=false;};
  },[requestLocation]));

  useFocusEffect(useCallback(()=>{
    if(!headingEnabled)return;
    let active=true;
    let foreground=AppState.currentState==='active';
    let stopWatch:(()=>void)|null=null;
    let observing=false;
    let lastStartAt=0;
    let lastValidAt=0;
    let invalidRun=0;
    let generation=0;
    // Preserve last-known display angle for brief interruptions; no guidance
    // is enabled until a fresh heading is accepted in the new focus session.
    setFreshness('recovering');

    /** One pipeline for both sources: filter → UI-thread needle → throttled text. */
    const accept=(trueHeading:number,quality:number,profile:HeadingProfile,now:number)=>{
      const result=filterQiblaHeading(filter.current,{trueHeading,accuracy:quality},now,profile);
      filter.current=result.filter;
      if(!result.accepted){
        invalidRun+=1;
        if(invalidRun>=3){
          lastValidAt=0; // Never revive the last accepted sample as live.
          setCompassAccuracy(quality>=0&&quality<=3?quality as CompassAccuracy:0);
          setFreshness('recovering');
          if(trueHeading<0)
            setMessage('Gerçek kuzey verisi bulunamadı. Konum ve pusula izinlerini kontrol et.');
        }
        return;
      }
      invalidRun=0;
      lastValidAt=now;
      const angle=result.filter!.angle;
      if(result.updated){
        advance(northAngle,lastNorth,angle);
        if(bearingRef.current!==null)
          advance(needleAngle,lastNeedle,(bearingRef.current-angle+360)%360);
      }
      if(now-lastTextAt.current>=TEXT_UPDATE_MS){
        lastTextAt.current=now;
        setCompassAccuracy(result.filter!.accuracy);
        setFreshness('live');
        // Text needs whole degrees only: identical values bail out of render.
        setHeading(Math.round(angle*2)/2);
      }
    };

    const onNative=(reading:NativeCompassReading)=>{
      if(!active||!foreground)return;
      const now=Date.now();
      const tiltState=qiblaTiltState(reading.tiltDeg);
      if(now-lastStatusAt.current>=SENSOR_STATUS_UPDATE_MS){
        lastStatusAt.current=now;
        setTilt(tiltState);
        const next=magneticInterference(reading.fieldUT,reading.expectedUT,interferenceRef.current);
        interferenceRef.current=next;
        setInterference(next);
        setErrorDegrees(reading.accuracyDeg>0&&reading.accuracyDeg<90
          ?Math.max(1,Math.round(reading.accuracyDeg)):null);
      }
      // Held upright the top edge has no horizontal direction: not an error,
      // just no heading — keep the session alive without an invalid streak.
      if(tiltState==='upright'||reading.magHeading<0){lastValidAt=now;return;}
      accept(normalizeReportedHeading(reading.trueHeading,reading.magHeading),
        reading.quality,'fused',now);
    };

    const remove=()=>{
      generation+=1;
      stopWatch?.();
      stopWatch=null;
      observing=false;
      lastValidAt=0;
    };
    const subscribe=()=>{
      if(!active||!foreground||observing)return;
      observing=true;
      const current=++generation;
      lastStartAt=Date.now();
      void (async()=>{
        try{
          if(await nativeCompassAvailable()){
            const stop=await watchNativeCompass(onNative);
            if(active&&foreground&&current===generation){
              stopWatch=stop;setCompassSource('fused');
            }else stop();
            return;
          }
          const subscription=await Location.watchHeadingAsync(reading=>{
            if(!active||!foreground||current!==generation)return;
            accept(normalizeReportedHeading(reading.trueHeading,reading.magHeading),
              reading.accuracy,'raw',Date.now());
          },()=>{
            if(active&&current===generation){
              setFreshness('recovering');
              setMessage('Pusula geçici olarak kesildi. Bağlantı yeniden kuruluyor.');
              remove();
            }
          });
          if(active&&foreground&&current===generation){
            stopWatch=()=>subscription.remove();setCompassSource('standard');
          }else subscription.remove();
        }catch{
          if(active&&current===generation){
            setFreshness('recovering');
            setMessage('Pusula sensörüne erişilemiyor; kalibrasyonu ve cihazı kontrol et.');
            remove();
          }
        }
      })();
    };
    const onAppState=AppState.addEventListener('change',state=>{
      foreground=state==='active';
      if(!foreground){
        remove();
        setFreshness('stale');
      }else{
        lastValidAt=0;
        subscribe();
        if(Date.now()-latestFixAt.current>=GPS_REFRESH_MS)
          void requestLocation(false);
      }
    });
    if(foreground)subscribe();
    const ticker=setInterval(()=>{
      if(!active||!foreground)return;
      const now=Date.now();
      const locationFresh=latestFixAt.current>0 &&
        now-latestFixAt.current<=QIBLA_POSITION_MAX_AGE_MS;
      setPositionUsable(old=>old===locationFresh?old:locationFresh);
      const fresh=lastValidAt?headingFreshness(lastValidAt,now):'recovering';
      setFreshness(previous=>previous===fresh?previous:fresh);
      const disconnected=!lastValidAt||now-lastValidAt>HEADING_RESUBSCRIBE_MS;
      if(disconnected&&now-lastStartAt>=HEADING_RETRY_GAP_MS){
        remove();
        setFreshness('recovering');
        subscribe();
      }
    },950);
    return()=>{
      active=false;
      clearInterval(ticker);
      onAppState.remove();
      remove();
      setFreshness('stale');
    };
  },[headingEnabled,cycle,requestLocation,needleAngle,northAngle]));

  // A new GPS bearing re-aims the needle immediately, even without rotation.
  useEffect(()=>{
    const angle=filter.current?.angle;
    if(bearing!==null&&angle!==undefined)
      advance(needleAngle,lastNeedle,(bearing-angle+360)%360);
  },[bearing,needleAngle]);

  const recalibrateHeading=useCallback(()=>{
    // Start a fresh foreground subscription without discarding the last
    // geodesic bearing or forcing the GPS permission flow again.
    filter.current=null;
    interferenceRef.current='unknown';
    setFreshness('recovering');
    setCompassAccuracy(null);
    setCycle(i=>i+1);
    setMessage('Telefonu havada yavaşça 8 şeklinde hareket ettirip yere paralel tut.');
  },[]);

  return {bearing,heading,compassAccuracy,freshness,
    locationAccuracy,locationLabel,distanceKm,positionSource,positionUsable,
    permissionDenied,busy,message,tilt,interference,errorDegrees,compassSource,
    needleAngle,northAngle,requestLocation,recalibrateHeading};
}
