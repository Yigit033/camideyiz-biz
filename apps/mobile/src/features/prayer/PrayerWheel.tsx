import {useEffect, useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Svg, {Circle, Defs, Ellipse, G, Line, LinearGradient, Path, RadialGradient, Stop} from 'react-native-svg';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {GestureDetector, usePanGesture} from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation, Easing, useAnimatedReaction, useAnimatedStyle,
  useReducedMotion, useSharedValue, withDecay, withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import {scheduleOnRN} from 'react-native-worklets';
import type {PrayerTime} from '@camideyiz/core';
import {
  timeToMinutes, angleOfTouch, normalizeDegrees,
  nearestCenterRotation, sectorAtNeedle, shortestAngularDelta,
  tangentialVelocity,
} from '@camideyiz/core';
import {type ColorTokens} from '@/theme/tokens';
import {DialLighting} from './DialLighting';

export const PRAYER_COLORS: Record<PrayerTime['key'], string> = {
  imsak: '#6BB5C9',
  gunes: '#E7B766',
  ogle: '#CEB27A',
  ikindi: '#36BDA0',
  aksam: '#D78C69',
  yatsi: '#8980C8',
};

const CENTER = 180;
const RADIUS = 133;
const DIAMETER = 360;
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
  const labelWidth = 64 * size / DIAMETER;
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
      {left: centerX - labelWidth / 2, top: centerY - 18 * size / DIAMETER, width: labelWidth,
        height: 36 * size / DIAMETER},
      style,
    ]}>
    <Text numberOfLines={1} adjustsFontSizeToFit style={{
      fontSize: (narrow ? 10.5 : 12.5) * size / DIAMETER,
      fontWeight: selected ? '900' : '700', letterSpacing: -0.3,
      color: sector.key === 'yatsi' ? '#FFF7F3' : '#132925', textAlign: 'center',
    }}>{sector.label}</Text>
    <Text numberOfLines={1} adjustsFontSizeToFit style={{
      fontSize: (narrow ? 10 : 11.5) * size / DIAMETER,
      fontWeight: '700', color: sector.key === 'yatsi' ? '#F3EEE9' : '#22483F',
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
};
export function PrayerWheel({
  times, selectedIndex, onSelect, focusRequest, size,
  colors, countdown, isManualSelection, nowSeconds,
}: Props) {
  const sectors = useMemo(() => segmentAngles(times), [times]);
  const reduceMotion = useReducedMotion();
  const initialCenter = sectors[selectedIndex]
    ? (sectors[selectedIndex].from + sectors[selectedIndex].to) / 2
    : 0;
  const rotation = useSharedValue(-initialCenter);
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
    if (focusRequest === 0 || !sectors[selectedIndex]) return;
    cancelAnimation(rotation);
    active.value = false;
    hasTouch.value = false;
    const destination = nearestCenterRotation(rotation.value, sectors[selectedIndex]);
    rotation.value = withTiming(destination, {
      duration: reduceMotion ? 0 : 510,
      easing: Easing.out(Easing.cubic),
    });
  }, [focusRequest]); // deliberately triggered by an explicit user action only

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
  const centerFill = colors.isDark ? '#132C27' : '#FFFDF7';
  const rim = colors.isDark ? '#D3B47A' : '#B7A078';
  const baseStroke = colors.isDark ? '#28423B' : '#E7E5D9';

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
            <Circle cx="180" cy="180" r={RADIUS} stroke={baseStroke} strokeWidth="52" fill="none"/>
            {sectors.map((item,index) => <G key={item.key}>
              {index === selectedIndex && <Path d={arc(item.from+.85,item.to-.85,RADIUS)}
                stroke={PRAYER_COLORS[item.key]} strokeOpacity=".22" strokeWidth="61" fill="none"/>}
              <Path d={arc(item.from+.9,item.to-.9,RADIUS)}
                stroke={'url(#fill-'+item.key+')'}
                strokeWidth={index===selectedIndex?51:47} fill="none"/>
              <Path d={arc(item.from+2,item.to-2,157)}
                stroke={index===selectedIndex?'#F9E7B8':'#FDFCF5'}
                strokeOpacity={index===selectedIndex?.86:.34}
                strokeWidth={index===selectedIndex?2.7:1.1} fill="none"/>
            </G>)}
            <Circle cx="180" cy="180" r="105" stroke={rim} strokeWidth="1.1"
              strokeOpacity=".7" fill="url(#dialInner)"/>
            <Circle cx="180" cy="180" r="100" stroke={rim} strokeWidth=".6"
              strokeOpacity=".28" fill="none"/>
            {sectors.map(item => {
              const p1=polar(item.from,108),p2=polar(item.from,159);
              return <Line key={'sep-'+item.key} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                stroke={colors.isDark?'#243A36':'#F9F8F3'} strokeWidth="2.1" opacity=".78"/>;
            })}
            {/* Small current-time marker rotates WITH the wheel: not the selection needle. */}
            <Circle cx={nowPoint.x} cy={nowPoint.y} r="8" fill={rim} fillOpacity=".16"/>
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

    <View pointerEvents="none" style={[styles.center, {width: size*.53}]}>
      <Svg width={89*scale} height={42*scale} viewBox="0 0 89 42" style={{marginBottom:5}}>
        <G fill={colors.gold} opacity=".86">
          <Path d="M19 40V24H26V16H31V12C35 8 41 7 44.5 2C48 7 54 8 58 12V16H63V24H70V40H58V27H31V40Z"/>
          <Path d="M9 40V14L12 7L15 14V40ZM75 40V14L78 7L81 14V40Z"/>
          <Ellipse cx="44.5" cy="15" rx="14" ry="6"/>
        </G>
        <Path d="M44.5 0V5" stroke={colors.gold} strokeWidth="1.4"/>
      </Svg>
      <Text style={[styles.kicker,{color:colors.gold}]}>
        {isManualSelection?'SEÇİLEN VAKİT':'SIRADAKİ VAKİT'}
      </Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.prayerName,{color:colors.text}]}>
        {selected?.label??'Vakit'}
      </Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.countdown,{color:colors.emerald}]}>
        {isManualSelection?selected?.time??'--:--':countdown}
      </Text>
      <View style={{width:37,height:1,backgroundColor:colors.gold,opacity:.7,marginVertical:5}}/>
      <Text style={[styles.caption,{color:colors.muted}]}>
        {isManualSelection?'Örnek saat':'Vakte kalan · demo'}
      </Text>
    </View>
  </View>;
}

const styles=StyleSheet.create({
  sectorLabel:{position:'absolute',alignItems:'center',justifyContent:'center',gap:1},
  needle:{position:'absolute',alignItems:'center',justifyContent:'center'},
  center:{position:'absolute',alignSelf:'center',alignItems:'center',gap:4},
  kicker:{fontSize:9,fontWeight:'800',letterSpacing:1.3},
  prayerName:{fontFamily:'serif',fontSize:23,fontWeight:'700',marginTop:1},
  countdown:{fontSize:29,fontWeight:'800',fontVariant:['tabular-nums'],letterSpacing:-.7,marginTop:3},
  caption:{fontSize:10,textAlign:'center'},
});
