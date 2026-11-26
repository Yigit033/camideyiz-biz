import {useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,Easing,StyleSheet,View} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import Svg,{Defs,RadialGradient,Stop,Circle} from 'react-native-svg';
import {useSharedPrayerSource} from '@/features/prayer/PrayerSourceProvider';

/**
 * Brand opening: a JS continuation of the NATIVE splash.
 *
 * The native splash (expo-splash-screen, app.json) paints #050A1D and the
 * approved mark at 150dp before any JS runs. This overlay renders the
 * identical frame; only after its image is decoded is the native splash
 * removed, so the hand-off is invisible. A short brand moment then reveals
 * the already-rendered Home underneath. JS/data work is never blocked: Home
 * mounts beneath the overlay from the first frame.
 */
export const SPLASH_BACKGROUND='#050A1D';
export const SPLASH_MARK_WIDTH=150; // MUST equal app.json expo-splash-screen imageWidth
const MIN_VISIBLE_MS=380;   // never a jarring flash
const MAX_WAIT_MS=1100;     // never hold the user back for slow networks
const NATIVE_HIDE_FALLBACK_MS=700;
const REVEAL_MS=520;

SplashScreen.preventAutoHideAsync().catch(()=>undefined);
let nativeHidden=false;
function hideNativeSplash(){
  if(nativeHidden)return;
  nativeHidden=true;
  try{SplashScreen.hide();}catch{/* already hidden */}
}
// Last-resort guard: a render error must never leave the native splash up.
setTimeout(hideNativeSplash,5000);

const mark=require('../../../assets/splash-mark.png');

export function BrandSplash(){
  const source=useSharedPrayerSource();
  const [done,setDone]=useState(false);
  const [revealing,setRevealing]=useState(false);
  const [imageReady,setImageReady]=useState(false);
  const mountedAt=useRef(Date.now()).current;
  const reduceMotion=useRef(false);
  const halo=useRef(new Animated.Value(0)).current;
  const exit=useRef(new Animated.Value(0)).current;

  useEffect(()=>{
    AccessibilityInfo.isReduceMotionEnabled()
      .then(value=>{reduceMotion.current=value;}).catch(()=>undefined);
    const fallback=setTimeout(()=>setImageReady(true),NATIVE_HIDE_FALLBACK_MS);
    return ()=>clearTimeout(fallback);
  },[]);

  // 1. Identical frame is on screen → remove the native splash, start the glow.
  useEffect(()=>{
    if(!imageReady)return;
    const frame=requestAnimationFrame(()=>{
      hideNativeSplash();
      if(!reduceMotion.current){
        Animated.timing(halo,{toValue:1,duration:420,easing:Easing.out(Easing.cubic),
          useNativeDriver:true}).start();
      }
    });
    return ()=>cancelAnimationFrame(frame);
  },[imageReady,halo]);

  // 2. Reveal once Home has its first data state (or the cap elapses).
  const homeSettled=source.status!=='loading';
  useEffect(()=>{
    if(!imageReady||revealing)return;
    const elapsed=Date.now()-mountedAt;
    const wait=homeSettled
      ?Math.max(0,MIN_VISIBLE_MS-elapsed)
      :Math.max(0,MAX_WAIT_MS-elapsed);
    const timer=setTimeout(()=>setRevealing(true),wait);
    return ()=>clearTimeout(timer);
  },[imageReady,homeSettled,revealing,mountedAt]);

  useEffect(()=>{
    if(!revealing)return;
    const animation=Animated.timing(exit,{
      toValue:1,duration:reduceMotion.current?200:REVEAL_MS,
      easing:Easing.inOut(Easing.cubic),useNativeDriver:true,
    });
    animation.start(({finished})=>{if(finished)setDone(true);});
    return ()=>animation.stop();
  },[revealing,exit]);

  if(done)return null;
  const markScale=reduceMotion.current?1:exit.interpolate({
    inputRange:[0,1],outputRange:[1,1.1]});
  const markOpacity=exit.interpolate({inputRange:[0,0.75],outputRange:[1,0],
    extrapolate:'clamp'});
  const fieldOpacity=exit.interpolate({inputRange:[0.2,1],outputRange:[1,0],
    extrapolate:'clamp'});
  const haloOpacity=Animated.multiply(halo,exit.interpolate({
    inputRange:[0,0.6],outputRange:[1,0],extrapolate:'clamp'}));
  const haloScale=exit.interpolate({inputRange:[0,1],outputRange:[1,1.5]});

  return <View pointerEvents={revealing?'none':'auto'} style={StyleSheet.absoluteFill}
    accessible accessibilityLabel="Camideyiz Biz açılıyor">
    <StatusBar style="light"/>
    <Animated.View style={[StyleSheet.absoluteFill,
      {backgroundColor:SPLASH_BACKGROUND,opacity:fieldOpacity}]}/>
    <View style={styles.center} pointerEvents="none">
      <Animated.View style={[styles.halo,{opacity:haloOpacity,transform:[{scale:haloScale}]}]}>
        <Svg width={HALO} height={HALO}>
          <Defs>
            <RadialGradient id="splashHalo" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#1FA8FF" stopOpacity="0.30"/>
              <Stop offset="0.45" stopColor="#0B6FD6" stopOpacity="0.12"/>
              <Stop offset="1" stopColor="#050A1D" stopOpacity="0"/>
            </RadialGradient>
          </Defs>
          <Circle cx={HALO/2} cy={HALO/2} r={HALO/2} fill="url(#splashHalo)"/>
        </Svg>
      </Animated.View>
      <Animated.Image source={mark} resizeMode="contain" fadeDuration={0}
        onLoadEnd={()=>setImageReady(true)}
        style={[styles.mark,{opacity:markOpacity,transform:[{scale:markScale}]}]}/>
    </View>
  </View>;
}
const HALO=SPLASH_MARK_WIDTH*2.4;
const styles=StyleSheet.create({
  center:{position:'absolute',top:0,right:0,bottom:0,left:0,
    alignItems:'center',justifyContent:'center'},
  halo:{position:'absolute',width:HALO,height:HALO},
  // Square box + contain == the native 150dp splash icon placement.
  mark:{width:SPLASH_MARK_WIDTH,height:SPLASH_MARK_WIDTH},
});
