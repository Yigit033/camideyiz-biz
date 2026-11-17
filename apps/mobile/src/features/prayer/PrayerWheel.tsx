import {useEffect, useMemo, useRef, type ComponentProps} from 'react';
import {StyleSheet,Text,View} from 'react-native';
import Svg, {Circle, Defs, Ellipse, G, Line, LinearGradient, Path, RadialGradient, Stop} from 'react-native-svg';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {GestureDetector, usePanGesture} from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation, Easing, useAnimatedReaction, useAnimatedStyle,
  useReducedMotion, useSharedValue, withSpring, withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import {scheduleOnRN} from 'react-native-worklets';
import type {PrayerTime,PrayerKey,RestrictionWindow,Urgency} from '@camideyiz/core';
import {
  angleOfTouch, normalizeDegrees,
  nearestCenterRotation, sectorAtNeedle, shortestAngularDelta,
  tangentialVelocity, makeVisualDialSectors, clockSecondsToVisualAngle,
  kerahatRingWindows,prayerSectorVisualLayout,currentPrayerArc,
  prayerBadgeForeground,PRAYER_BADGE_LIGHT_INK,
} from '@camideyiz/core';
import {type ColorTokens} from '@/theme/tokens';
import {DialLighting} from './DialLighting';


export const PRAYER_COLORS: Record<PrayerTime['key'], string> = {
  imsak:'#3593B5',
  gunes:'#D69E44',
  ogle:'#1EAFB0',
  ikindi:'#10B981',
  aksam:'#DA7049',
  yatsi:'#7162BB',
};

const CENTER = 180;
const RADIUS = 139;
const DIAMETER = 360;
function blendHex(a:string,b:string,alpha:number):string {
  const extract=(s:string,n:number)=>parseInt(s.slice(n,n+2),16);
  const mix=(x:number,y:number)=>Math.round(x*(1-alpha)+y*alpha).toString(16).padStart(2,'0');
  return '#'+[1,3,5].map(p=>mix(extract(a,p),extract(b,p))).join('');
}
const PRAYER_COUNTDOWN_LABELS:Record<PrayerTime['key'],string> = {
  imsak:'İmsağa Kalan',gunes:'Güneşe Kalan',ogle:'Öğleye Kalan',
  ikindi:'İkindiye Kalan',aksam:'Akşama Kalan',yatsi:'Yatsıya Kalan',
};
const PRAYER_ICONS: Record<PrayerTime['key'], ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  imsak:'moon-waning-crescent',gunes:'weather-sunset-up',ogle:'white-balance-sunny',
  ikindi:'timer-sand',aksam:'weather-sunset-down',yatsi:'weather-night',
};
type PrayerArc = PrayerTime & {from: number; to: number};

/** Published prayer period length / 24-hour clock. No nonlinear decoration. */
export function segmentAngles(times:readonly PrayerTime[]):PrayerArc[] {
  return makeVisualDialSectors(times);
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
/** One upright pictogram at the exact angular centre of its prayer period. */
function SectorIcon({sector,size,rotation}:{
  sector:PrayerArc;size:number;rotation:SharedValue<number>;
}){
  const layout=prayerSectorVisualLayout(sector.from,sector.to);
  const point=polar(layout.labelAngle,layout.labelRadius);
  const scale=size/DIAMETER;
  const width=layout.labelWidth*scale,height=layout.labelHeight*scale;
  const contrastInk=sector.key==='yatsi'?'#FFF6E6'
    :sector.key==='aksam'?'#3A241B':'#16372E';
  const unrotate=useAnimatedStyle(()=>({
    transform:[{rotateZ:-rotation.value+'deg'}],
  }));
  return <Animated.View pointerEvents="none"
    style={[styles.sectorLabel,{
      left:point.x*scale-width/2,top:point.y*scale-height/2,
      width,height,
    },unrotate]}>
    <MaterialCommunityIcons name={PRAYER_ICONS[sector.key]}
      size={layout.iconSize*scale} color={contrastInk}/>
  </Animated.View>;
}

/** HH:MM and its name share one capsule at the exact boundary angle.
 * Counter-rotation keeps both text lines upright during free rotation.
 */
function SectorStartClock({sector,size,rotation,preview=false}:{
  sector:PrayerArc;size:number;rotation:SharedValue<number>;preview?:boolean;
}){
  const layout=prayerSectorVisualLayout(sector.from,sector.to);
  const point=polar(layout.clockAngle,layout.clockRadius);
  const scale=size/DIAMETER;
  const width=layout.clockWidth*scale,height=layout.clockHeight*scale;
  // Match each badge to its exact sector colour in both app themes.
  const badgeColor=PRAYER_COLORS[sector.key];
  const ink=prayerBadgeForeground(badgeColor);
  const badgeBorder=ink===PRAYER_BADGE_LIGHT_INK
    ?'rgba(255,255,255,.66)':'rgba(8,26,38,.56)';
  const unrotate=useAnimatedStyle(()=>({
    transform:[{rotateZ:-rotation.value+'deg'}],
  }));
  if(preview)return null;
  return <Animated.View pointerEvents="none"
    style={[styles.sectorStartClock,{
      left:point.x*scale-width/2,top:point.y*scale-height/2,
      width,height,borderRadius:10*scale,
      paddingVertical:1*scale,
      backgroundColor:badgeColor,borderColor:badgeBorder,
    },unrotate]}>
    <Text allowFontScaling={false} numberOfLines={1} style={{
      fontVariant:['tabular-nums'],fontSize:10.1*scale,
      lineHeight:12.3*scale,color:ink,
      fontWeight:'900',textAlign:'center',
    }}>{sector.time}</Text>
    <Text allowFontScaling={false} numberOfLines={1} style={{
      fontSize:layout.fontSize*scale,
      lineHeight:10.5*scale,color:ink,
      fontFamily:'serif',fontWeight:'700',textAlign:'center',
    }}>{sector.label}</Text>
  </Animated.View>;
}

type Props = {
  times: readonly PrayerTime[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** Called after a real annular drag begins / ends; used to arm live return. */
  onGestureStart?: () => void;
  onGestureEnd?: () => void;
  focusRequest: number;
  size: number;
  colors: ColorTokens;
  countdown: string;
  isManualSelection: boolean;
  nowSeconds: number;
  urgency: Urgency;
  nextKey: PrayerKey;
  restriction: RestrictionWindow | null;
  indicativeWindows: readonly RestrictionWindow[];
  /** Explicit no-schedule state: a visual, manually rotatable wheel with no computed times. */
  preview?: boolean;
  locationName?: string;
  previousYatsiTime?:string|null;
  nextImsakTime?:string|null;
};
export function PrayerWheel({
  times, selectedIndex, onSelect, onGestureStart, onGestureEnd, focusRequest, size,
  colors, countdown, isManualSelection, nowSeconds,
  urgency, nextKey, restriction, indicativeWindows,
  preview=false, locationName, previousYatsiTime, nextImsakTime,
}: Props) {
  // Placeholders must NEVER be parsed as real clock times or used to calculate phases.
  const sectors = useMemo(() => preview
    ?times.map((item,index)=>({...item,from:index*60,to:(index+1)*60}))
    :segmentAngles(times), [times,preview]);
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

  // Only explicit focus requests or a new live prayer period re-center the dial.
  // Ordinary rotation-induced selection changes must never interrupt a drag.
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
    // Physically damped self-centering, with no overshoot into a different
    // prayer period. Shortest-angle math works even after multiple turns.
    rotation.value = reduceMotion
      ? withTiming(destination, {duration:0})
      : withSpring(destination, {
          damping:22,stiffness:autoShift?105:96,
          mass:.9,overshootClamping:true,
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
      if (onGestureStart) scheduleOnRN(onGestureStart);
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
      // Start the quiet period when the finger actually leaves the screen.
      // Any subsequent touch cancels the pending return on the RN thread.
      if (onGestureEnd) scheduleOnRN(onGestureEnd);
      const dx=event.x-centerPt,dy=event.y-centerPt;
      const velocity=event.canceled||reduceMotion?0
        :tangentialVelocity(dx,dy,event.velocityX,event.velocityY);
      // Predict only a small flick (rather than a long-running decay).
      // This guarantees the idle-return can never race infinite inertia.
      const projected=rotation.value+velocity*.13;
      const idx=sectorAtNeedle(projected,sectorBounds);
      if(idx<0){active.value=false;return;}
      const destination=nearestCenterRotation(rotation.value,sectorBounds[idx]);
      rotation.value=withTiming(destination,{
        duration:reduceMotion?0:event.canceled?180:340,
        easing:Easing.out(Easing.cubic),
      },()=>{active.value=false;});
    },
  });

  // Only send semantic changes across the UI/RN thread boundary, not every touch frame.
  useAnimatedReaction(
    () => active.value ? sectorAtNeedle(rotation.value, sectorBounds) : -1,
    (index, previous) => {
      if (index >= 0 && index !== previous) scheduleOnRN(onSelect, index);
    },
  );

  const liveArc=preview?null:currentPrayerArc(
    nowSeconds,times,sectors,previousYatsiTime,nextImsakTime);
  const currentAngle=liveArc?.progressAngle??0;
  const nowPoint=polar(currentAngle,163);
  const currentSector=liveArc?sectors[liveArc.sectorIndex]:null;
  // Clock marks are painted only INSIDE the time band they belong to.
  // No generic 72-tick decorative ring or whole-circle progress arc.
  const clockTicks=preview?[]:Array.from({length:24},(_,hour)=>{
    const angle=clockSecondsToVisualAngle(hour*3600,times,sectors);
    const sector=sectors.find(item=>
      angle>item.from+.8&&angle<item.to-.8);
    if(!sector)return null;
    return {hour,angle,sector};
  }).filter((entry):entry is {hour:number;angle:number;sector:PrayerArc}=>entry!==null);
  const selected = sectors[selectedIndex];
  const centerFill = colors.isDark ? '#081D2F' : '#FFF9EF';
  const rim = colors.isDark ? '#ECD19B' : '#C39B55';
  const baseStroke = colors.isDark ? '#0D304C' : '#E9E3D2';
  // Recompute progress from the actual civil-time prayer boundaries,
  // independent from any manually selected dial wedge.
  const boost=urgency==='normal'?0.12:urgency==='approaching'?0.45:0.8;
  const ringWindows=preview?[]:kerahatRingWindows(indicativeWindows,nowSeconds);
  const kerahatActive=ringWindows.some(window=>window.state==='active');
  const kerahatApproaching=ringWindows.some(window=>window.state==='approaching');
  const warningTint=kerahatActive?'#9B3546':kerahatApproaching?'#CA863E':null;
  const progressTint=warningTint??PRAYER_COLORS[currentSector?.key??'imsak'];
  const kerahatArcs=ringWindows.flatMap(window=>{
    const from=clockSecondsToVisualAngle(window.startSeconds,times,sectors);
    const to=clockSecondsToVisualAngle(window.endSeconds,times,sectors);
    // Explicitly clip to each matching prayer period, never paint a warning
    // across the dividers into a different coloured prayer band.
    return sectors.flatMap(sector=>{
      const start=Math.max(from,sector.from);
      const end=Math.min(to,sector.to);
      // Never trim minute-based kerahat durations by a decorative margin.
      return end>start+.02?[{...window,from:start,to:end,
        sectorKey:sector.key}]:[];
    });
  });
  const nextGlowStrength=0.12+0.5*boost*Math.pow(liveArc?.progress??0,1.35);

  return <View style={{width: size, height: size, alignSelf: 'center', justifyContent: 'center'}}>
    <DialLighting size={size} dark={colors.isDark}/>
    <GestureDetector gesture={panGesture}>
      <View style={{width: size, height: size}} collapsable={false}>
        <Animated.View style={[{width: size, height: size}, ringStyle]}>
          <Svg width={size} height={size} viewBox="0 0 360 360" pointerEvents="none">
            <Defs>
              <RadialGradient id="dialInner" cx="46%" cy="40%" rx="72%" ry="72%">
                <Stop offset="0%" stopColor={colors.isDark ? '#264F6B' : '#FFFFFF'}/>
                <Stop offset="100%" stopColor={centerFill}/>
              </RadialGradient>
              {sectors.map(item => <LinearGradient id={'fill-'+item.key} key={item.key}
                x1="12%" y1="5%" x2="92%" y2="98%">
                <Stop offset="0%" stopColor={blendHex(PRAYER_COLORS[item.key],'#FFFFFF',colors.isDark?.29:.44)}/>
                <Stop offset="28%" stopColor={PRAYER_COLORS[item.key]}/>
                <Stop offset="72%" stopColor={blendHex(PRAYER_COLORS[item.key],'#061B1C',colors.isDark?.29:.12)}/>
                <Stop offset="100%" stopColor={blendHex(PRAYER_COLORS[item.key],'#061B1C',colors.isDark?.48:.26)}/>
              </LinearGradient>)}
            </Defs>
            <Circle cx="180" cy="180" r="176" stroke={rim} strokeWidth="0.8" strokeOpacity=".55" fill="none"/>
            <Circle cx="180" cy="180" r="169" stroke={rim} strokeWidth="1" strokeOpacity=".36" fill="none"/>
            <Circle cx="180" cy="180" r={RADIUS} stroke={baseStroke} strokeWidth="65" fill="none"/>
            {sectors.map((item,index) => <G key={item.key}>
              {!preview && item.key===nextKey && <>
                <Path d={arc(item.from+.6,item.to-.6,RADIUS)}
                  stroke={warningTint??PRAYER_COLORS[item.key]}
                  strokeOpacity={nextGlowStrength*.46}
                  strokeWidth={urgency==='normal'?80:88} fill="none"/>
                <Path d={arc(item.from+.6,item.to-.6,RADIUS)}
                  stroke={warningTint??blendHex(PRAYER_COLORS[item.key],'#FCECCB',.25)}
                  strokeOpacity={nextGlowStrength}
                  strokeWidth={urgency==='normal'?71:77} fill="none"/>
              </>}
              {index === selectedIndex && <Path d={arc(item.from+.85,item.to-.85,RADIUS)}
                stroke={PRAYER_COLORS[item.key]} strokeOpacity=".37" strokeWidth="71" fill="none"/>}
              <Path d={arc(item.from+.9,item.to-.9,RADIUS)}
                stroke={'url(#fill-'+item.key+')'}
                strokeWidth={index===selectedIndex?63:58} fill="none"/>
              <Path d={arc(item.from+2,item.to-2,169)}
                stroke={index===selectedIndex?'#FFE9B7':'#F9F2DC'}
                strokeOpacity={index===selectedIndex?.94:.37}
                strokeWidth={index===selectedIndex?4.3:1.8} fill="none"/>
              <Path d={arc(item.from+2,item.to-2,114)}
                stroke={index===selectedIndex?'#FFF6DC':'#F8E9C8'}
                strokeOpacity={index===selectedIndex?.42:.18}
                strokeWidth={index===selectedIndex?4.2:2.1} fill="none"/>
              <Path d={arc(item.from+2,item.to-2,149)}
                stroke="#FFF9E4"
                strokeOpacity={index===selectedIndex?.15:.07}
                strokeWidth="11" fill="none"/>
            </G>)}
            {/* 24 civil-hour divisions, each coloured by its actual
                prayer interval. Render above wedges, below kerahat warnings. */}
            {clockTicks.map(item=>{
              const major=item.hour%3===0;
              const start=polar(item.angle,major?167:170);
              const end=polar(item.angle,major?177:175);
              return <Line key={'hour-'+item.hour}
                x1={start.x} y1={start.y}
                x2={end.x} y2={end.y}
                stroke={blendHex(PRAYER_COLORS[item.sector.key],'#E9D09B',.54)}
                strokeWidth={major?1.75:1.05}
                strokeOpacity={major?.95:.73}/>;
            })}
            <Circle cx="180" cy="180" r="106" stroke={rim} strokeWidth="2.2"
              strokeOpacity=".7" fill="url(#dialInner)"/>
            <Circle cx="180" cy="180" r="101" stroke={rim} strokeWidth=".8"
              strokeOpacity=".28" fill="none"/>
            {sectors.map(item => {
              const p1=polar(item.from,108),p2=polar(item.from,169);
              return <Line key={'sep-'+item.key} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                stroke={colors.isDark?'#071E2D':'#FFF9EA'} strokeWidth="2.7" opacity=".87"/>;
            })}
            {/* Approximate kerahat arcs share the SAME angular coordinates
                on two concentric tracks. Outer = warning, inner = interval.
                Both rotate WITH the physical dial, never with elapsed progress.
                Active: deep burgundy; next 20min: warm amber; otherwise muted. */}
            {kerahatArcs.length>0
              ?<Circle cx="180" cy="180" r="112" fill="none"
                stroke={rim} strokeOpacity=".48" strokeWidth="3"/>:null}
            {kerahatArcs.map(window=><G key={'kerahat-'+window.kind+'-'+window.sectorKey}>
              {window.state!=='inactive'?<Path
                d={arc(window.from,window.to,112)}
                stroke={window.state==='active'?'#AE4054':'#D49A55'}
                strokeOpacity=".34" strokeWidth="17" fill="none"
                strokeLinecap="round"/>:null}
              <Path d={arc(window.from,window.to,112)}
                stroke={window.state==='active'?'#962F44'
                  :window.state==='approaching'?'#C7823C':'#C5716F'}
                strokeOpacity={window.state==='inactive'?.73:1}
                strokeWidth={window.state==='active'?12.6
                  :window.state==='approaching'?11:8}
                fill="none" strokeLinecap="round"/>
              <Path d={arc(window.from,window.to,112)}
                stroke="#FFE1AC"
                strokeOpacity={window.state==='inactive'?.37:.8}
                strokeWidth={window.state==='active'?1.7:1.3}
                fill="none"/>
              {window.state!=='inactive'?<Path
                d={arc(window.from,window.to,161)}
                stroke={window.state==='active'?'#8E2639':'#B97032'}
                strokeOpacity=".26" strokeWidth="16"
                fill="none" strokeLinecap="butt"/>:null}
              <Path d={arc(window.from,window.to,161)}
                stroke={window.state==='active'?'#952F43'
                  :window.state==='approaching'?'#C7853D':'#A76D66'}
                strokeOpacity={window.state==='inactive'?.51:1}
                strokeWidth={window.state==='active'?11.2
                  :window.state==='approaching'?9.6:6}
                fill="none" strokeLinecap="butt"/>
              {window.state==='active'?<Path
                d={arc(window.from,window.to,158.5)}
                stroke="#EDB4A1" strokeOpacity=".82"
                strokeWidth="1.3" fill="none"/>:null}
            </G>)}
            {/* Current period progress shares the SAME rotation and actual
                boundary angles as the coloured sector and kerahat bands. */}
            {liveArc&&currentSector?<G>
              <Path d={arc(liveArc.from+.5,liveArc.to-.5,174)}
                stroke={colors.isDark?'#E2D0AA':'#735C39'}
                strokeOpacity={colors.isDark?.48:.35}
                strokeWidth="5.2" strokeLinecap="butt" fill="none"/>
              {liveArc.progress>.001?<Path
                d={arc(liveArc.from+.1,Math.max(liveArc.from+.25,
                  Math.min(liveArc.to-.05,liveArc.progressAngle)),174)}
                stroke={progressTint} strokeOpacity=".29"
                strokeWidth="10.2" strokeLinecap="round" fill="none"/>:null}
              {liveArc.progress>.001?<Path
                d={arc(liveArc.from+.1,Math.max(liveArc.from+.25,
                  Math.min(liveArc.to-.05,liveArc.progressAngle)),174)}
                stroke={progressTint} strokeWidth="5.4"
                strokeLinecap="round" fill="none"/>:null}
              <Circle cx={polar(currentAngle,174).x} cy={polar(currentAngle,174).y}
                r="4.7" fill={progressTint}
                stroke={colors.isDark?'#092D29':'#FFF8EA'} strokeWidth="1.6"/>
            </G>:null}
            {/* Small current-time marker rotates WITH the wheel: not the selection needle. */}
            {!preview?<G>
              <Circle cx={nowPoint.x} cy={nowPoint.y} r="8"
                fill={kerahatActive?'#9B3546':kerahatApproaching?'#C7853D':rim}
                fillOpacity=".26"/>
              <Circle cx={nowPoint.x} cy={nowPoint.y} r="4.1"
                fill={kerahatActive?'#9B3546':kerahatApproaching?'#C7853D':rim}
                stroke={centerFill} strokeWidth="1"/>
              {currentSector&&currentAngle>currentSector.from+.15
                ?<Path d={arc(currentSector.from+.1,currentAngle,165)}
                  stroke={kerahatActive?'#A82F45'
                    :kerahatApproaching?'#C7853D'
                    :PRAYER_COLORS[currentSector.key]}
                  strokeOpacity=".84" strokeWidth="3"
                  strokeLinecap="round" fill="none"/>
                :null}
            </G>:null}
          </Svg>
          {sectors.map(item=><SectorIcon key={'icon-'+item.key}
             sector={item} size={size} rotation={rotation}/>)} 
          {sectors.map(item=><SectorStartClock key={'clock-'+item.key}
            sector={item} size={size} rotation={rotation} preview={preview}/>)}
        </Animated.View>
      </View>
    </GestureDetector>

    <View pointerEvents="none" style={{
      position:'absolute',alignSelf:'center',width:size*.585,height:size*.585,
      alignItems:'center',justifyContent:'center',
    }}>
      <Svg width="100%" height="100%" viewBox="0 0 220 220" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="medallion" cx="50%" cy="52%" rx="60%" ry="61%">
            <Stop offset="0%" stopColor={colors.isDark?'#0B2D47':'#FFFDF8'}/>
            <Stop offset="76%" stopColor={colors.isDark?'#08253C':'#FEF7EA'}/>
            <Stop offset="100%" stopColor={colors.isDark?'#0A3452':'#DDD6C7'}/>
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
      <View style={[styles.center,{width:size*.57,gap:5}]}>
        <View style={{flexDirection:'row',alignItems:'center',gap:5}}>
          <View style={{width:20,height:1,backgroundColor:colors.gold,opacity:.75}}/>
          <MaterialCommunityIcons name="star-four-points-outline" size={12} color={colors.gold}/>
          <View style={{width:20,height:1,backgroundColor:colors.gold,opacity:.75}}/>
        </View>
        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.kicker,{color:colors.muted}]}>
          {preview?'NAMAZ VAKİTLERİ':isManualSelection?'SEÇİLEN VAKİT':'SIRADAKİ VAKİT'}
        </Text>
        <Text numberOfLines={1} adjustsFontSizeToFit
          style={[styles.prayerName,{color:colors.text}]}>
          {preview?'Takvim Bekleniyor'
            :isManualSelection?(selected?.label??'Vakit')
              :PRAYER_COUNTDOWN_LABELS[nextKey]}
        </Text>
        <Text numberOfLines={1} adjustsFontSizeToFit
          style={[styles.countdown,{color:colors.emerald}]}>
          {preview?'--:--':isManualSelection?selected?.time??'--:--':countdown}
        </Text>
        <View style={{height:1,width:'62%',backgroundColor:colors.gold,
          opacity:.55,marginVertical:2}}/>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'center',
          gap:4,maxWidth:'100%'}}>
          <MaterialCommunityIcons name="map-marker-outline" size={13} color={colors.gold}/>
          <Text numberOfLines={1} adjustsFontSizeToFit
            style={[styles.caption,{color:colors.muted,flexShrink:1}]}>
            {preview?'Konum takvimi bekleniyor':locationName??'İlçe seçilmedi'}
          </Text>
        </View>
      </View>
    </View>
  </View>;
}

const styles=StyleSheet.create({
  sectorLabel:{position:'absolute',alignItems:'center',justifyContent:'center'},
  sectorStartClock:{position:'absolute',alignItems:'center',justifyContent:'center',
    borderWidth:.8},
  center:{alignItems:'center',justifyContent:'center',gap:3},
  kicker:{fontSize:9,fontWeight:'800',letterSpacing:1.15,textAlign:'center'},
  prayerName:{fontFamily:'serif',fontSize:17,fontWeight:'800',textAlign:'center'},
  countdown:{fontSize:31,fontWeight:'800',fontFamily:'serif',fontVariant:['tabular-nums'],letterSpacing:-.8},
  caption:{fontSize:10.5,fontFamily:'serif',textAlign:'center'},
});
