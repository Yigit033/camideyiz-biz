import {useEffect, useMemo, useRef, type ComponentProps} from 'react';
import {Image,StyleSheet,Text,View} from 'react-native';
import Svg, {Circle, Defs, Ellipse, G, Line, LinearGradient, Path, RadialGradient, Stop} from 'react-native-svg';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {GestureDetector, usePanGesture} from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation, Easing, useAnimatedReaction, useAnimatedStyle,
  useReducedMotion, useSharedValue, withDecay, withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import {scheduleOnRN} from 'react-native-worklets';
import type {PrayerTime,PrayerKey,RestrictionWindow,Urgency} from '@camideyiz/core';
import {
  timeToMinutes, angleOfTouch, normalizeDegrees,
  nearestCenterRotation, sectorAtNeedle, shortestAngularDelta,
  tangentialVelocity,
} from '@camideyiz/core';
import {type ColorTokens} from '@/theme/tokens';
import {DialLighting} from './DialLighting';
import {MosqueLandscape} from '@/components/LuxuryArtwork';

export const PRAYER_COLORS: Record<PrayerTime['key'], string> = {
  imsak: '#6BB5C9',
  gunes: '#E7B766',
  ogle: '#CEB27A',
  ikindi: '#36BDA0',
  aksam: '#D78C69',
  yatsi: '#8980C8',
};

const CENTER = 180;
const RADIUS = 139;
const DIAMETER = 360;
const PRAYER_COUNTDOWN_LABELS:Record<PrayerTime['key'],string> = {
  imsak:'İmsağa Kalan',gunes:'Güneşe Kalan',ogle:'Öğleye Kalan',
  ikindi:'İkindiye Kalan',aksam:'Akşama Kalan',yatsi:'Yatsıya Kalan',
};
const PRAYER_ICONS: Record<PrayerTime['key'], ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  imsak:'moon-waning-crescent',gunes:'weather-sunset-up',ogle:'white-balance-sunny',
  ikindi:'timer-sand',aksam:'weather-sunset-down',yatsi:'weather-night',
};
type PrayerArc = PrayerTime & {from: number; to: number};

export function segmentAngles(times: readonly PrayerTime[]): PrayerArc[] {
  if (!times.length) return [];
  const minutes = times.map(item => timeToMinutes(item.time));
  if (minutes.some((minute, index) => index > 0 && minute <= minutes[index - 1])) {
    throw new RangeError('Daily times must be ascending');
  }
  return times.map((item, index) => {
    const start = (minutes[index] - minutes[0] + 1440) % 1440;
    const end = index === times.length - 1 ? 1440 : (minutes[index + 1] - minutes[0] + 1440) % 1440;
    return {...item, from: start / 1440 * 360, to: end / 1440 * 360};
  });
}
function polar(degrees: number, radius: number) {
  const a = degrees * Math.PI / 180;
  return {x: CENTER + radius * Math.sin(a), y: CENTER - radius * Math.cos(a)};
}
function arc(from: number, to: number, radius: number) {
  const start = polar(from, radius), end = polar(to, radius);
  return 'M ' + start.x.toFixed(3) + ' ' + start.y.toFixed(3) +
    ' A ' + radius + ' ' + radius + ' 0 ' + (to - from > 180 ? 1 : 0) +
    ' 1 ' + end.x.toFixed(3) + ' ' + end.y.toFixed(3);
}
function SectorLabel({
  sector, size, rotation, selected, dark,
}: {
  sector: PrayerArc; size: number; rotation: SharedValue<number>; selected: boolean; dark: boolean;
}) {
  const point = polar((sector.from + sector.to) / 2, RADIUS);
  const iconSize = 14 * size / DIAMETER;
  const labelWidth = 72 * size / DIAMETER;
  const centerX = point.x * size / DIAMETER;
  const centerY = point.y * size / DIAMETER;
  const style = useAnimatedStyle(() => ({
    transform: [{rotateZ: (-rotation.value) + 'deg'}],
  }));
  const narrow = sector.to - sector.from < 28;
  return <Animated.View
    pointerEvents="none"
    style={[
      styles.sectorLabel,
      {left: centerX - labelWidth / 2, top: centerY - 28 * size / DIAMETER, width: labelWidth,
        height: 56 * size / DIAMETER},
      style,
    ]}>
    <MaterialCommunityIcons name={PRAYER_ICONS[sector.key]} size={iconSize}
      color={selected || sector.key === 'yatsi' ? '#FFF4DA' : '#164038'}/>
    <Text numberOfLines={1} adjustsFontSizeToFit style={{
      fontSize: (narrow ? 10.1 : 12) * size / DIAMETER,
      fontFamily:'serif',fontWeight:'700',letterSpacing:-.15,
      color: selected || sector.key === 'yatsi' ? '#FFFCF3' : '#18372F', textAlign:'center',
    }}>{sector.label}</Text>
    <Text numberOfLines={1} adjustsFontSizeToFit style={{
      fontSize: (narrow ? 9.7 : 11.3) * size / DIAMETER,
      fontWeight: '700', color: selected || sector.key === 'yatsi' ? '#FFF7E9' : '#23473E',
      textAlign: 'center', marginTop: 2 * size / DIAMETER,
    }}>{sector.time}</Text>
  </Animated.View>;
}

type Props = {
  times: readonly PrayerTime[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  focusRequest: number;
  size: number;
  colors: ColorTokens;
  countdown: string;
  isManualSelection: boolean;
  nowSeconds: number;
  phaseProgress: number;
  urgency: Urgency;
  nextKey: PrayerKey;
  restriction: RestrictionWindow | null;
  indicativeWindows: readonly RestrictionWindow[];
};
export function PrayerWheel({
  times, selectedIndex, onSelect, focusRequest, size,
  colors, countdown, isManualSelection, nowSeconds,
  phaseProgress, urgency, nextKey, restriction, indicativeWindows,
}: Props) {
  const sectors = useMemo(() => segmentAngles(times), [times]);
  const reduceMotion = useReducedMotion();
  const initialCenter = sectors[selectedIndex]
    ? (sectors[selectedIndex].from + sectors[selectedIndex].to) / 2
    : 0;
  const rotation = useSharedValue(-initialCenter);
  const previousSelected = useRef(selectedIndex);
  const previousFocus = useRef(focusRequest);
  const active = useSharedValue(false);
  const prevTouch = useSharedValue(0);
  const hasTouch = useSharedValue(false);
  const scale = size / DIAMETER;
  const centerPt = size / 2;
  const sectorBounds = useMemo(
    () => sectors.map(({from, to}) => ({from, to})), [sectors],
  );

  // Requests originate from the bottom chips or the "live" button, not from the dial.
  // This avoids re-centering on each segment boundary while the user is dragging.
  useEffect(() => {
    const autoShift=!isManualSelection && previousSelected.current!==selectedIndex;
    const explicitlyRequested=previousFocus.current!==focusRequest;
    previousSelected.current=selectedIndex;
    previousFocus.current=focusRequest;
    // Do not interrupt the user dragging the dial when selection changes.
    if ((!explicitlyRequested && !autoShift) || !sectors[selectedIndex]) return;
    // Auto-follow when the clock crosses an actual prayer boundary, not each second.
    cancelAnimation(rotation);
    active.value = false;
    hasTouch.value = false;
    const destination = nearestCenterRotation(rotation.value, sectors[selectedIndex]);
    rotation.value = withTiming(destination, {
      duration: reduceMotion ? 0 : autoShift ? 780 : 510,
      easing: Easing.out(Easing.cubic),
    });
  }, [focusRequest,selectedIndex,isManualSelection]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{rotateZ: rotation.value + 'deg'}],
  }));

  const panGesture = usePanGesture({
    minDistance: 2,
    maxPointers: 1,
    onActivate: (event) => {
      'worklet';
      const x = event.x - centerPt, y = event.y - centerPt;
      const r = Math.sqrt(x * x + y * y);
      // Only the annular surface behaves as the physical dial.
      if (r < size * .255 || r > size * .505) {
        active.value = false;
        hasTouch.value = false;
        return;
      }
      cancelAnimation(rotation);
      prevTouch.value = angleOfTouch(event.x, event.y, centerPt);
      hasTouch.value = true;
      active.value = true;
    },
    onUpdate: (event) => {
      'worklet';
      if (!active.value || !hasTouch.value) return;
      const x = event.x - centerPt, y = event.y - centerPt;
      if (x * x + y * y < (size * .125) ** 2) return;
      const angle = angleOfTouch(event.x, event.y, centerPt);
      const delta = shortestAngularDelta(prevTouch.value, angle);
      // Unwrapped rotation is continuous through 0/360: one physical revolution is one turn.
      rotation.value += delta;
      prevTouch.value = angle;
    },
    onDeactivate: (event) => {
      'worklet';
      if (!active.value || !hasTouch.value) return;
      hasTouch.value = false;
      if (event.canceled || reduceMotion) {
        const idx = sectorAtNeedle(rotation.value, sectorBounds);
        if (idx >= 0) {
          rotation.value = withTiming(
            nearestCenterRotation(rotation.value, sectorBounds[idx]),
            {duration: reduceMotion ? 0 : 260, easing: Easing.out(Easing.cubic)},
            () => {active.value = false;},
          );
        } else active.value = false;
        return;
      }
      const dx = event.x - centerPt, dy = event.y - centerPt;
      const velocity = tangentialVelocity(dx, dy, event.velocityX, event.velocityY);
      rotation.value = withDecay({velocity, deceleration: .966}, (finished) => {
        if (!finished) return;
        const idx = sectorAtNeedle(rotation.value, sectorBounds);
        if (idx < 0) {active.value = false;return;}
        const target = nearestCenterRotation(rotation.value, sectorBounds[idx]);
        rotation.value = withTiming(target, {
          duration: 350,
          easing: Easing.out(Easing.cubic),
        }, () => {active.value = false;});
      });
    },
  });

  // Only send semantic changes across the UI/RN thread boundary, not every touch frame.
  useAnimatedReaction(
    () => active.value ? sectorAtNeedle(rotation.value, sectorBounds) : -1,
    (index, previous) => {
      if (index >= 0 && index !== previous) scheduleOnRN(onSelect, index);
    },
  );

  const secondsFromImsak = times.length ? timeToMinutes(times[0].time) * 60 : 0;
  const currentAngle = ((nowSeconds - secondsFromImsak + 86400) % 86400) / 86400 * 360;
  const nowPoint = polar(currentAngle, 170);
  const selected = sectors[selectedIndex];
  const centerFill = colors.isDark ? '#081E21' : '#FFF9EF';
  const rim = colors.isDark ? '#ECD19B' : '#C39B55';
  const baseStroke = colors.isDark ? '#07332F' : '#E9E3D2';
  // One-second sampling changes the progress while the physical dial remains UI-thread driven.
  const progress=Math.max(0,Math.min(1,phaseProgress));
  const boost=urgency==='normal'?0.12:urgency==='approaching'?0.45:0.8;
  const warningTint=restriction ? '#EF6F72' : null;
  const progressTint=warningTint??(urgency==='normal'?PRAYER_COLORS[nextKey]:
    nextKey==='aksam'?'#F6B46F':colors.isDark?'#F4D58B':'#B9823D');
  const demoArcs=indicativeWindows.map(window=>{
    const startSeconds=timeToMinutes(times[0].time)*60;
    const from=((window.startSeconds-startSeconds+86400)%86400)/86400*360;
    const to=((window.endSeconds-startSeconds+86400)%86400)/86400*360;
    return {...window,from,to};
  }).filter(window=>window.to>window.from);
  const nextGlowStrength=0.12+0.5*boost*Math.pow(progress,1.35);

  return <View style={{width: size, height: size, alignSelf: 'center', justifyContent: 'center'}}>
    <DialLighting size={size} dark={colors.isDark}/>
    <GestureDetector gesture={panGesture}>
      <View style={{width: size, height: size}} collapsable={false}>
        <Animated.View style={[{width: size, height: size}, ringStyle]}>
          <Svg width={size} height={size} viewBox="0 0 360 360" pointerEvents="none">
            <Defs>
              <RadialGradient id="dialInner" cx="46%" cy="40%" rx="72%" ry="72%">
                <Stop offset="0%" stopColor={colors.isDark ? '#294B40' : '#FFFFFF'}/>
                <Stop offset="100%" stopColor={centerFill}/>
              </RadialGradient>
              {sectors.map(item => <LinearGradient id={'fill-'+item.key} key={item.key}
                x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={PRAYER_COLORS[item.key]} stopOpacity=".88"/>
                <Stop offset="60%" stopColor={PRAYER_COLORS[item.key]}/>
                <Stop offset="100%" stopColor={PRAYER_COLORS[item.key]} stopOpacity=".93"/>
              </LinearGradient>)}
            </Defs>
            <Circle cx="180" cy="180" r="176" stroke={rim} strokeWidth="0.8" strokeOpacity=".55" fill="none"/>
            <Circle cx="180" cy="180" r="169" stroke={rim} strokeWidth="1" strokeOpacity=".36" fill="none"/>
            {Array.from({length: 72}, (_,i) => {
              const a = i*5;
              const start = polar(a, i%6===0 ? 172:174),end=polar(a,i%6===0?179:177);
              return <Line key={'tick-'+i} x1={start.x} y1={start.y}
                x2={end.x} y2={end.y} stroke={rim}
                strokeWidth={i%6===0?1.7:.75} strokeOpacity={i%6===0?.9:.36}/>;
            })}
            <Circle cx="180" cy="180" r={RADIUS} stroke={baseStroke} strokeWidth="65" fill="none"/>
            {sectors.map((item,index) => <G key={item.key}>
              {item.key===nextKey && <Path d={arc(item.from+.6,item.to-.6,RADIUS)}
                stroke={warningTint??PRAYER_COLORS[item.key]} strokeOpacity={nextGlowStrength}
                strokeWidth={urgency==='normal'?70:77} fill="none"/>}
              {index === selectedIndex && <Path d={arc(item.from+.85,item.to-.85,RADIUS)}
                stroke={PRAYER_COLORS[item.key]} strokeOpacity=".37" strokeWidth="71" fill="none"/>}
              <Path d={arc(item.from+.9,item.to-.9,RADIUS)}
                stroke={'url(#fill-'+item.key+')'}
                strokeWidth={index===selectedIndex?63:58} fill="none"/>
              <Path d={arc(item.from+2,item.to-2,169)}
                stroke={index===selectedIndex?'#F9E7B8':'#FDFCF5'}
                strokeOpacity={index===selectedIndex?.86:.34}
                strokeWidth={index===selectedIndex?4:1.8} fill="none"/>
            </G>)}
            <Circle cx="180" cy="180" r="106" stroke={rim} strokeWidth="2.2"
              strokeOpacity=".7" fill="url(#dialInner)"/>
            <Circle cx="180" cy="180" r="101" stroke={rim} strokeWidth=".8"
              strokeOpacity=".28" fill="none"/>
            {sectors.map(item => {
              const p1=polar(item.from,108),p2=polar(item.from,169);
              return <Line key={'sep-'+item.key} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                stroke={colors.isDark?'#062724':'#FFF9EA'} strokeWidth="2.7" opacity=".87"/>;
            })}
            {/* Approximate Diyanet-inspired demo restriction bands, NEVER asserted as precise. */}
            {demoArcs.map(window=><G key={'kerahat-'+window.kind}>
              <Path d={arc(window.from,window.to,166)}
                stroke={restriction?.kind===window.kind?'#FA7E7E':'#C86569'}
                strokeOpacity={restriction?.kind===window.kind?.97:.55}
                strokeWidth={restriction?.kind===window.kind?6.5:4.3} fill="none"
                strokeDasharray={restriction?.kind===window.kind?'0':'2,2'}/>
              <Path d={arc(window.from,window.to,166)}
                stroke="#FFDBB4" strokeOpacity={restriction?.kind===window.kind?.7:.32}
                strokeWidth=".8" fill="none"/>
            </G>)}
            {/* Small current-time marker rotates WITH the wheel: not the selection needle. */}
            <Circle cx={nowPoint.x} cy={nowPoint.y} r="8" fill={restriction?'#E96870':rim} fillOpacity=".21"/>
            <Circle cx={nowPoint.x} cy={nowPoint.y} r="4.1" fill={rim} stroke={centerFill} strokeWidth="1"/>
            <Path d={arc(0,Math.max(.01,currentAngle),167)} stroke={rim}
              strokeOpacity=".58" strokeWidth="1.8" fill="none"/>
          </Svg>
          {sectors.map((item,index) => <SectorLabel
            key={item.key} sector={item} size={size}
            rotation={rotation} selected={index===selectedIndex} dark={colors.isDark}/>)}
        </Animated.View>
      </View>
    </GestureDetector>

    {/* Real-time progress remains fixed, independent from the physical rotating dial. */}
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={size} height={size} viewBox="0 0 360 360">
      <Defs>
        <LinearGradient id="liveBar" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={progressTint} stopOpacity=".72"/>
          <Stop offset="100%" stopColor={progressTint} stopOpacity="1"/>
        </LinearGradient>
      </Defs>
      <Circle cx="180" cy="180" r="175" fill="none"
        stroke={colors.isDark?'#D1BB8D':'#CBB589'} strokeOpacity=".25" strokeWidth="4"/>
      {progress>.001?<Path
        d={arc(0,Math.max(.2,Math.min(359.8,progress*359.8)),175)}
        fill="none" stroke={progressTint} strokeOpacity={urgency==='normal'?.30:.38}
        strokeWidth={urgency==='imminent'?12:8} strokeLinecap="round"/>:null}
      {progress>.001?<Path
        d={arc(0,Math.max(.2,Math.min(359.8,progress*359.8)),175)}
        fill="none" stroke="url(#liveBar)" strokeWidth={urgency==='imminent'?5.5:4}
        strokeLinecap="round"/>:null}
      {progress>.001 && <Circle cx={polar(progress*359.8,175).x}
        cy={polar(progress*359.8,175).y}
        r={urgency==='imminent'?6.4:4.7} fill={progressTint}
        stroke={colors.isDark?'#082A27':'#FFF8EB'} strokeWidth="1.8"/>}
    </Svg>

    {/* Static top needle: all prayer segments rotate UNDER this indicator. */}
    <View pointerEvents="none" style={[styles.needle, {
      left: centerPt-10, top: 8*scale, width:20*scale, height:31*scale,
    }]}>
      <Svg width="100%" height="100%" viewBox="0 0 20 31">
        <Path d="M10 0 L19 11 L10 25 L1 11 Z" fill={rim}/>
        <Circle cx="10" cy="10" r="2.8" fill={colors.isDark?'#18362E':'#FBF8EA'}/>
        <Path d="M10 24 L10 31" stroke={rim} strokeWidth="1.5"/>
      </Svg>
    </View>

    <View pointerEvents="none" style={{
      position:'absolute',alignSelf:'center',width:size*.585,height:size*.585,
      alignItems:'center',justifyContent:'center',
    }}>
      <Svg width="100%" height="100%" viewBox="0 0 220 220" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="medallion" cx="50%" cy="52%" rx="60%" ry="61%">
            <Stop offset="0%" stopColor={colors.isDark?'#07282A':'#FFFDF8'}/>
            <Stop offset="76%" stopColor={colors.isDark?'#052326':'#FEF7EA'}/>
            <Stop offset="100%" stopColor={colors.isDark?'#082F30':'#DDD6C7'}/>
          </RadialGradient>
        </Defs>
        <Circle cx="110" cy="110" r="108" fill="url(#medallion)" stroke={rim} strokeWidth="1.65"/>
        <Circle cx="110" cy="110" r="104" fill="none" stroke={rim} strokeOpacity=".38" strokeWidth=".8"/>
        {Array.from({length:36},(_,i)=>{
          const a=(i*10)*Math.PI/180;return <Circle key={i}
            cx={110+101*Math.cos(a)} cy={110+101*Math.sin(a)} r=".68"
            fill={colors.gold} opacity={colors.isDark?.44:.42}/>;
        })}
      </Svg>
      <View style={[styles.center,{width:size*.56}]}>
        <View style={{width:size*.43,height:size*.43*.48,overflow:'hidden',
          borderRadius:Math.max(5,size*.016),opacity:colors.isDark?.90:.84}}>
          <MosqueLandscape width={size*.43} dark={colors.isDark}/>
          <Image
            source={colors.isDark
              ? require('../../../assets/scenes/dark-mosque.webp')
              : require('../../../assets/scenes/light-mosque.webp')}
            resizeMode="cover"
            style={{position:'absolute',width:'100%',height:'100%'}}/>
        </View>
        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.prayerName,{color:colors.text}]}>
          {isManualSelection?(selected?.label??'Vakit'):(selected?PRAYER_COUNTDOWN_LABELS[selected.key]:'Vakte Kalan')}
        </Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.countdown,{color:colors.emerald}]}>
          {isManualSelection?selected?.time??'--:--':countdown}
        </Text>
        <View style={{flexDirection:'row',alignItems:'center',gap:5,marginTop:2}}>
          <View style={{width:24,height:1,backgroundColor:colors.gold,opacity:.78}}/>
          <MaterialCommunityIcons name="star-four-points-outline" size={13} color={colors.gold}/>
          <View style={{width:24,height:1,backgroundColor:colors.gold,opacity:.78}}/>
        </View>
        <View style={{flexDirection:'row',alignItems:'center',gap:4,marginTop:2}}>
          <MaterialCommunityIcons name="map-marker-outline" size={12} color={colors.muted}/>
          <Text style={[styles.caption,{color:colors.muted}]}>
            {isManualSelection?'Seçilen vakit · örnek':'İstanbul · demo'}
          </Text>
        </View>
      </View>
    </View>
  </View>;
}

const styles=StyleSheet.create({
  sectorLabel:{position:'absolute',alignItems:'center',justifyContent:'center',gap:1},
  needle:{position:'absolute',alignItems:'center',justifyContent:'center'},
  center:{alignItems:'center',justifyContent:'center',gap:3},
  kicker:{fontSize:9,fontWeight:'800',letterSpacing:1.3},
  prayerName:{fontFamily:'serif',fontSize:19,fontWeight:'700',marginTop:-2,textAlign:'center'},
  countdown:{fontSize:29,fontWeight:'700',fontFamily:'serif',fontVariant:['tabular-nums'],letterSpacing:-.8,marginTop:-1},
  caption:{fontSize:10.5,fontFamily:'serif',textAlign:'center'},
});
