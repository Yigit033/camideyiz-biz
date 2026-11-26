import {memo, useEffect, useMemo, useRef, type ComponentProps} from 'react';
import {StyleSheet,Text,View} from 'react-native';
import Svg, {Circle, Defs, G, Line, LinearGradient, Path, RadialGradient, Stop} from 'react-native-svg';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import Animated, {
  cancelAnimation, Easing, useAnimatedStyle,
  useReducedMotion, useSharedValue, withSpring, withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import type {PrayerTime,PrayerKey,RestrictionWindow,Urgency} from '@camideyiz/core';
import {
  nearestCenterRotation, makeVisualDialSectors, clockSecondsToVisualAngle,
  kerahatRingWindows,prayerSectorVisualLayout,nearestLiveDialRotation,
  prayerBadgeForeground,PRAYER_BADGE_LIGHT_INK,
} from '@camideyiz/core';
import {type ColorTokens} from '@/theme/tokens';
import {DialLighting} from './DialLighting';
import {
  centerMedallionLayout,CENTER_ROWS,MEDALLION_RINGS,MEDALLION_VIEWBOX,MINARET_VIEWBOX,
} from './centerMedallionLayout';
import {
  MINARET_DETAIL,MINARET_FILLS,MINARET_PALETTE,MINARET_SHAPES,MINARET_STOPS,MINARET_STROKE,
} from './ottomanMinaret';


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
const MEDALLION_MID = MEDALLION_VIEWBOX/2;
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

/** Short status under the live countdown while a kerahet window is active. */
const KERAHET_LABEL_COLOR={dark:'#F2A54A',light:'#A64B0B'} as const;

/**
 * Classical Ottoman minaret (Süleymaniye type), drawn from ottomanMinaret.ts:
 * gilded alem, lead pencil külah, petek windows, three şerefe on muqarnas
 * corbels and a slender fluted stone shaft, each piece shaded as a cylinder.
 * Openings are cut in the medallion colour so they read as pierced on either
 * theme. Memoised: the dial re-renders every second, the minaret only when
 * the theme or the dial size changes.
 */
const OttomanMinaret=memo(function OttomanMinaret({width,height,dark,cutout}:{
  width:number;height:number;dark:boolean;cutout:string;
}){
  const tone=dark?MINARET_PALETTE.dark:MINARET_PALETTE.light;
  return <View accessible accessibilityRole="image" accessibilityLabel="Osmanlı minaresi"
    style={{width,height}}>
    <Svg width={width} height={height}
      viewBox={'0 0 '+MINARET_VIEWBOX.width+' '+MINARET_VIEWBOX.height}>
      <Defs>
        {MINARET_FILLS.map(fill=><LinearGradient key={fill} id={'minaret-'+fill}
          x1="0" y1="0" x2="1" y2="0">
          {tone[fill].map((color,i)=>
            <Stop key={i} offset={MINARET_STOPS[i]} stopColor={color}/>)}
        </LinearGradient>)}
        <LinearGradient id="minaret-drop" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={tone.niche} stopOpacity={MINARET_STROKE.dropOpacity}/>
          <Stop offset="1" stopColor={tone.niche} stopOpacity="0"/>
        </LinearGradient>
      </Defs>
      {MINARET_SHAPES.map((shape,i)=><Path key={i} d={shape.d}
        fill={'url(#minaret-'+shape.fill+')'} stroke={tone.edge}
        strokeWidth={MINARET_STROKE.edge} strokeOpacity={MINARET_STROKE.edgeOpacity}
        strokeLinejoin="round"/>)}
      <Path d={MINARET_DETAIL.drops} fill="url(#minaret-drop)"/>
      <Path d={MINARET_DETAIL.courses} fill="none" stroke={tone.course}
        strokeWidth={MINARET_STROKE.course} strokeOpacity={tone.courseOpacity}/>
      <Path d={MINARET_DETAIL.niches} fill={tone.niche} fillOpacity={tone.nicheOpacity}/>
      <Path d={MINARET_DETAIL.cut} fill={cutout}/>
      <Path d={MINARET_DETAIL.glints} fill="none" stroke={tone.glint}
        strokeWidth={MINARET_STROKE.glint} strokeOpacity={MINARET_STROKE.glintOpacity}
        strokeLinecap="round"/>
    </Svg>
  </View>;
});

/** line ✦ line ornament of the centre medallion. */
function CenterOrnament({unit,color}:{unit:number;color:string}){
  const rule={width:54*unit,height:1,backgroundColor:color,opacity:.7};
  return <View style={{flexDirection:'row',alignItems:'center',
    gap:6*unit,height:CENTER_ROWS.ornament*unit}}>
    <View style={rule}/>
    <MaterialCommunityIcons name="star-four-points-outline"
      size={CENTER_ROWS.ornament*unit} color={color}/>
    <View style={rule}/>
  </View>;
}

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
function SectorIcon({sector,size,rotation,dark}:{
  sector:PrayerArc;size:number;rotation:SharedValue<number>;dark:boolean;
}){
  const layout=prayerSectorVisualLayout(sector.from,sector.to);
  const point=polar(layout.labelAngle,layout.labelRadius);
  const scale=size/DIAMETER;
  const width=layout.labelWidth*scale,height=layout.labelHeight*scale;
  const contrastInk=sector.key==='yatsi'?'#FFF6E6'
    :sector.key==='aksam'?'#3A241B':dark?'#0B2A44':'#16372E';
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
 * Counter-rotation keeps both text lines upright as the dial turns.
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
  /** Explicit no-schedule state: a visual wheel with no computed times. */
  preview?: boolean;
  locationName?: string;
  previousYatsiTime?:string|null;
  nextImsakTime?:string|null;
};
export function PrayerWheel({
  times, selectedIndex, focusRequest, size,
  colors, countdown, isManualSelection, nowSeconds,
  urgency, nextKey, restriction, indicativeWindows,
  preview=false, locationName, previousYatsiTime, nextImsakTime,
}: Props) {
  // Placeholders must NEVER be parsed as real clock times or used to calculate phases.
  const sectors = useMemo(() => preview
    ?times.map((item,index)=>({...item,from:index*60,to:(index+1)*60}))
    :segmentAngles(times), [times,preview]);
  const reduceMotion = useReducedMotion();
  const initialAngle=preview
    ?(sectors[selectedIndex]?(sectors[selectedIndex].from+sectors[selectedIndex].to)/2:0)
    :clockSecondsToVisualAngle(nowSeconds,times,sectors);
  const rotation = useSharedValue(-initialAngle);
  const previousFocus = useRef(focusRequest);
  const previousManual=useRef(isManualSelection);

  // Live 24-hour clock drives the entire ring. One revolution is one real
  // day; no synthetic speed boost and no jump at 360°/tomorrow's İmsak.
  // The dial is never turned by hand (owner, 26.11.2026): it only follows
  // the clock, and a tapped prayer card turns it to that prayer until the
  // idle auto-return.
  const liveAngle=preview?0:clockSecondsToVisualAngle(nowSeconds,times,sectors);
  useEffect(()=>{
    const focusChanged=previousFocus.current!==focusRequest;
    const returning=previousManual.current&&!isManualSelection;
    previousFocus.current=focusRequest;
    previousManual.current=isManualSelection;
    if(preview||isManualSelection){
      if(!focusChanged||!sectors[selectedIndex])return;
      cancelAnimation(rotation);
      const focused=nearestCenterRotation(rotation.value,sectors[selectedIndex]);
      rotation.value=reduceMotion?withTiming(focused,{duration:0}):
        withSpring(focused,{damping:22,stiffness:96,
          mass:.9,overshootClamping:true});
      return;
    }
    const destination=nearestLiveDialRotation(rotation.value,liveAngle);
    // Faster damped return after exploring a prayer, then very gentle
    // linear second-by-second tracking.
    if(returning){
      cancelAnimation(rotation);
      rotation.value=reduceMotion?withTiming(destination,{duration:0}):
        withSpring(destination,{damping:25,stiffness:108,
          mass:.92,overshootClamping:true});
    }else{
      rotation.value=withTiming(destination,{
        duration:reduceMotion?0:1100,easing:Easing.linear,
      });
    }
  },[focusRequest,selectedIndex,isManualSelection,preview,liveAngle,reduceMotion]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{rotateZ: rotation.value + 'deg'}],
  }));

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
  // Distinct high-contrast status colours; no change to kerahet intervals.
  const warningTint=kerahatActive?'#9B3546':kerahatApproaching?'#C78A38':null;
  // The live countdown gains a "Kerahet" line; exploring a prayer hides it.
  const showKerahet=!preview&&!isManualSelection&&kerahatActive;
  const layout=centerMedallionLayout(size,showKerahet);
  const unit=layout.unit;
  const kerahatArcs=ringWindows.flatMap(window=>{
    const from=clockSecondsToVisualAngle(window.startSeconds,times,sectors);
    const to=clockSecondsToVisualAngle(window.endSeconds,times,sectors);
    // Explicitly clip to each matching prayer period, never paint a warning
    // across the dividers into a different coloured prayer band.
    return sectors.flatMap(sector=>{
      const start=Math.max(from,sector.from);
      const end=Math.min(to,sector.to);
      // Never trim minute-based kerahet durations by a decorative margin.
      return end>start+.02?[{...window,from:start,to:end,
        sectorKey:sector.key}]:[];
    });
  });
  const nextGlowStrength=0.12+0.5*boost;

  return <View style={{width: size, height: size, alignSelf: 'center', justifyContent: 'center'}}>
    <DialLighting size={size} dark={colors.isDark}/>
    {/* The turning dial. Touches pass through it, so scrolling the page
        never turns it. */}
    <View style={{width: size, height: size}} pointerEvents="none">
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
              <Stop offset="72%" stopColor={blendHex(PRAYER_COLORS[item.key],colors.isDark?'#061A2C':'#061B1C',colors.isDark?.29:.12)}/>
              <Stop offset="100%" stopColor={blendHex(PRAYER_COLORS[item.key],colors.isDark?'#061A2C':'#061B1C',colors.isDark?.48:.26)}/>
            </LinearGradient>)}
          </Defs>
          {warningTint?<Circle cx="180" cy="180" r="173"
            stroke={warningTint} strokeWidth={kerahatActive?9:6}
            strokeOpacity={kerahatActive?.42:.30} fill="none"/>:null}
          <Circle cx="180" cy="180" r="176" stroke={warningTint??rim}
            strokeWidth={kerahatActive?3.5:kerahatApproaching?2.6:.8}
            strokeOpacity={warningTint?1:.55} fill="none"/>
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
              prayer interval. Render above wedges, below kerahet warnings. */}
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
          {/* Approximate kerahet arcs share the SAME angular coordinates
              on two concentric tracks. Outer = warning, inner = interval.
              Both rotate WITH the physical dial, never with elapsed progress.
              Active: deep burgundy; next 20min: warm amber; otherwise muted. */}
          {kerahatArcs.length>0
            ?<Circle cx="180" cy="180" r="112" fill="none"
              stroke={rim} strokeOpacity=".62" strokeWidth="3.2"/>:null}
          {kerahatArcs.map(window=><G key={'kerahat-'+window.kind+'-'+window.sectorKey}>
            {window.state!=='inactive'?<Path
              d={arc(window.from,window.to,112)}
              stroke={window.state==='active'?'#AE4054':'#D49A55'}
              strokeOpacity={window.state==='active'?.55:.40}
              strokeWidth={window.state==='active'?22:19} fill="none"
              strokeLinecap="round"/>:null}
            <Path d={arc(window.from,window.to,112)}
              stroke={window.state==='active'?'#B82B4C'
                :window.state==='approaching'?'#E3A94E':'#A74F58'}
              strokeOpacity={window.state==='inactive'?.91:1}
              strokeWidth={window.state==='active'?15.5
                :window.state==='approaching'?13.2:9.6}
              fill="none" strokeLinecap="round"/>
            <Path d={arc(window.from,window.to,112)}
              stroke="#FFE1AC"
              strokeOpacity={window.state==='inactive'?.55:.95}
              strokeWidth={window.state==='active'?2.3:1.7}
              fill="none"/>
            {window.state!=='inactive'?<Path
              d={arc(window.from,window.to,161)}
              stroke={window.state==='active'?'#8E2639':'#B97032'}
              strokeOpacity={window.state==='active'?.48:.34}
              strokeWidth={window.state==='active'?21:18}
              fill="none" strokeLinecap="butt"/>:null}
            <Path d={arc(window.from,window.to,161)}
              stroke={window.state==='active'?'#B32E49'
                :window.state==='approaching'?'#E3A34E':'#A15B5E'}
              strokeOpacity={window.state==='inactive'?.82:1}
              strokeWidth={window.state==='active'?14
                :window.state==='approaching'?12:8.5}
              fill="none" strokeLinecap="butt"/>
            {window.state==='active'?<Path
              d={arc(window.from,window.to,158.5)}
              stroke="#FFE2CA" strokeOpacity="1"
              strokeWidth="2.2" fill="none"/>:null}
          </G>)}
        </Svg>
        {sectors.map(item=><SectorIcon key={'icon-'+item.key}
           sector={item} size={size} rotation={rotation} dark={colors.isDark}/>)} 
        {sectors.map(item=><SectorStartClock key={'clock-'+item.key}
          sector={item} size={size} rotation={rotation} preview={preview}/>)}
      </Animated.View>
    </View>

    <View pointerEvents="none" style={{
      position:'absolute',alignSelf:'center',
      width:layout.medallion,height:layout.medallion,
    }}>
      <Svg width="100%" height="100%" viewBox={'0 0 '+MEDALLION_VIEWBOX+' '+MEDALLION_VIEWBOX}
        style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="medallion" cx="50%" cy="52%" rx="60%" ry="61%">
            <Stop offset="0%" stopColor={colors.isDark?'#0B2D47':'#FFFDF8'}/>
            <Stop offset="76%" stopColor={colors.isDark?'#08253C':'#FEF7EA'}/>
            <Stop offset="100%" stopColor={colors.isDark?'#0A3452':'#DDD6C7'}/>
          </RadialGradient>
        </Defs>
        <Circle cx={MEDALLION_MID} cy={MEDALLION_MID} r={MEDALLION_RINGS.outer}
          fill="url(#medallion)" stroke={warningTint??rim}
          strokeWidth={kerahatActive?3.4:kerahatApproaching?2.5:1.65}/>
        <Circle cx={MEDALLION_MID} cy={MEDALLION_MID} r={MEDALLION_RINGS.inner}
          fill="none" stroke={rim} strokeOpacity=".38" strokeWidth={MEDALLION_RINGS.innerStroke}/>
        {Array.from({length:36},(_,i)=>{
          const a=(i*10)*Math.PI/180;return <Circle key={i}
            cx={MEDALLION_MID+MEDALLION_RINGS.dots*Math.cos(a)}
            cy={MEDALLION_MID+MEDALLION_RINGS.dots*Math.sin(a)}
            r={MEDALLION_RINGS.dotRadius}
            fill={colors.gold} opacity={colors.isDark?.44:.42}/>;
        })}
      </Svg>
      {/* Stationary centre (outside the rotating dial). The minaret crowns
          the medallion, anchored one breath under the top gold dot ring.
          Below it, one equal gap apart: ornament, "<vakit>a Kalan",
          countdown, [Kerahet], ornament, location. Every size scales with
          the dial and texts do not font-scale, so it all stays inside the
          ring (see centerMedallionLayout). */}
      <View style={[styles.minaret,{
        left:layout.minaret.left,top:layout.minaret.top,
      }]}>
        <OttomanMinaret width={layout.minaret.width} height={layout.minaret.height}
          dark={colors.isDark} cutout={colors.isDark?'#08253C':'#FEF7EA'}/>
      </View>
      <View style={[styles.center,{
        left:layout.stack.left,top:layout.stack.top,
        width:layout.stack.width,gap:layout.stack.gap,
      }]}>
        <CenterOrnament unit={unit} color={colors.gold}/>
        <View style={{alignItems:'center',alignSelf:'stretch'}}>
          <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit
            style={[styles.prayerName,{color:colors.text,
              fontSize:18*unit,lineHeight:CENTER_ROWS.title*unit}]}>
            {preview?'Takvim Bekleniyor'
              :isManualSelection?(selected?.label??'Vakit')
                :PRAYER_COUNTDOWN_LABELS[nextKey]}
          </Text>
          <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit
            style={[styles.countdown,{color:colors.emerald,
              fontSize:32*unit,lineHeight:CENTER_ROWS.countdown*unit,
              marginTop:CENTER_ROWS.countdownGap*unit}]}>
            {preview?'--:--':isManualSelection?selected?.time??'--:--':countdown}
          </Text>
          {showKerahet?<Text allowFontScaling={false} numberOfLines={1}
            style={[styles.kerahet,{
              color:colors.isDark?KERAHET_LABEL_COLOR.dark:KERAHET_LABEL_COLOR.light,
              fontSize:14*unit,lineHeight:CENTER_ROWS.kerahet*unit,
            }]}>Kerahet</Text>:null}
        </View>
        <CenterOrnament unit={unit} color={colors.gold}/>
        {/* As wide as the inner gold ring allows at the row's lowest edge. */}
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'center',
          gap:4*unit,height:CENTER_ROWS.location*unit,maxWidth:layout.locationMaxWidth}}>
          <MaterialCommunityIcons name="map-marker-outline"
            size={13*unit} color={colors.gold}/>
          <Text allowFontScaling={false} numberOfLines={1}
            adjustsFontSizeToFit minimumFontScale={.6}
            style={[styles.caption,{color:colors.muted,flexShrink:1,
              fontSize:12*unit,lineHeight:CENTER_ROWS.location*unit}]}>
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
  minaret:{position:'absolute'},
  center:{position:'absolute',alignItems:'center'},
  prayerName:{fontFamily:'serif',fontWeight:'800',textAlign:'center',
    includeFontPadding:false,textAlignVertical:'center'},
  countdown:{fontWeight:'800',fontFamily:'serif',fontVariant:['tabular-nums'],letterSpacing:-.8,
    textAlign:'center',includeFontPadding:false,textAlignVertical:'center'},
  kerahet:{fontFamily:'serif',fontWeight:'800',letterSpacing:.3,textAlign:'center',
    includeFontPadding:false,textAlignVertical:'center'},
  caption:{fontFamily:'serif',textAlign:'center',
    includeFontPadding:false,textAlignVertical:'center'},
});
