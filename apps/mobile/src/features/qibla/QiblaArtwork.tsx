import {memo,useEffect,useMemo,useRef} from 'react';
import {Image,StyleSheet,View} from 'react-native';
import Svg,{
  Circle,Defs,Ellipse,G,Line,LinearGradient,Path,Polygon,
  RadialGradient,Rect,Stop,Text as SvgText,
} from 'react-native-svg';
import Animated,{Easing,useAnimatedStyle,useSharedValue,withTiming} from 'react-native-reanimated';
import {normalizeBearing} from '@camideyiz/core';

const GOLD='#E0BE7A',IVORY='#F7E8CB',EMERALD='#15493D';
const DIAL=360;

function KaabaSymbol({x=180,y=58}: {x?:number;y?:number}){
  return <G transform={'translate('+x+' '+y+')'}>
    <Circle r="27" fill="#E6B85E" opacity=".13"/>
    <Circle r="23" fill="#071E1A" stroke="#FFE8A6" strokeWidth="2.4"/>
    <Circle r="19" fill="#0C2C24" stroke="#8C6E3B" strokeWidth=".8"/>
    <Path d="M-12 -7 L0 -11 L13 -5 L1 -1 Z" fill="#CDA75D"/>
    <Path d="M-12 -7 L1 -1 V13 L-12 8 Z" fill="#1F2624"/>
    <Path d="M1 -1 L13 -5 V8 L1 13 Z" fill="#080E11"/>
    <Path d="M-12 0 L1 6 L13 2 M-12 3 L1 9 L13 5" fill="none"
      stroke="#EBC477" strokeWidth="2"/>
  </G>;
}

export const QiblaBackdrop=memo(function QiblaBackdrop({dark}: {dark:boolean}){
  const sky=dark?'#053E37':'#D6EAE0';
  const silhouette=dark?'#081E1D':'#9CAD9A';
  const horizon=dark?'#051C1B':'#D1D8C8';
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <Svg width="100%" height="100%" viewBox="0 0 390 840"
      preserveAspectRatio="xMidYMin slice">
      <Defs>
        <LinearGradient id="nightWash" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={dark?'#052C29':'#F8F6EB'}/>
          <Stop offset="28%" stopColor={dark?'#08463C':'#E8EEE0'}/>
          <Stop offset="56%" stopColor={dark?'#043D33':'#EDF0E3'}/>
          <Stop offset="100%" stopColor={dark?'#001F1D':'#F7F3E9'}/>
        </LinearGradient>
        <RadialGradient id="skyBloom" cx="79%" cy="21%" rx="60%" ry="43%">
          <Stop offset="0%" stopColor={dark?'#D8B06C':'#E1BF84'} stopOpacity={dark?'.49':'.29'}/>
          <Stop offset="51%" stopColor={dark?'#3B8575':'#A9D8C9'} stopOpacity=".23"/>
          <Stop offset="100%" stopColor={sky} stopOpacity="0"/>
        </RadialGradient>
        <LinearGradient id="fadingWater" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={dark?'#236F61':'#BCD5C8'} stopOpacity=".3"/>
          <Stop offset="100%" stopColor={horizon} stopOpacity="0"/>
        </LinearGradient>
        <LinearGradient id="archMetal" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#5A4022"/>
          <Stop offset="22%" stopColor="#F6D99A"/>
          <Stop offset="45%" stopColor="#B78845"/>
          <Stop offset="70%" stopColor="#F5D391"/>
          <Stop offset="100%" stopColor="#805B30"/>
        </LinearGradient>
      </Defs>
      <Rect width="390" height="840" fill="url(#nightWash)"/>
      <Rect width="390" height="510" fill="url(#skyBloom)"/>
      <Circle cx="325" cy="162" r="105" fill="#EAB76B" opacity={dark?'.05':'.04'}/>
      <G opacity={dark?'.13':'.09'} stroke={GOLD} strokeWidth=".8" fill="none">
        {Array.from({length:8},(_,i)=><G key={'geo-'+i} transform={'translate('+(-45+i*70)+' 20)'}>
          <Path d="M0 -40L34 0L0 40L-34 0Z M0 -21L20 0L0 21L-20 0Z"/>
          <Circle r="24"/>
        </G>)}
      </G>
      {/* Elegant five-lobed golden header arch and interior seam. */}
      <Path d="M-19 119 Q10 93 39 100 Q58 46 95 51 Q117 5 157 29
        Q190 -33 239 28 Q275 4 303 52 Q343 43 354 99 Q374 93 410 118"
        stroke="url(#archMetal)" strokeWidth="4.5" fill="none"/>
      <Path d="M-19 124 Q10 98 39 105 Q58 51 95 56 Q117 10 157 34
        Q190 -28 239 33 Q275 9 303 57 Q343 48 354 104 Q374 98 410 123"
        stroke="#E7C889" strokeOpacity=".34" strokeWidth="1" fill="none"/>
      {/* Decorative architectural skyline, designed as soft atmospheric scenery. */}
      <G opacity={dark?'.69':'.34'} fill={silhouette}>
        <Path d="M208 295 H390 V352 H205Z"/>
        <Path d="M248 298 V257 Q284 207 319 257 V298Z"/>
        <Path d="M263 256 Q284 217 306 256" stroke="#BFA46E" strokeWidth="1" fill="none"/>
        <Path d="M274 231V217 M282 219V207 M279 211L286 213" stroke="#EAC78D" strokeWidth="1.3" fill="none"/>
        <Path d="M222 299V274Q236 251 249 274V299Z"/>
        <Path d="M316 299V274Q333 249 349 274V299Z"/>
        <Path d="M207 303V181H215V303Z M205 182 L211 143L217 182Z"/>
        <Path d="M356 299V159H364V299Z M354 161L360 119L366 161Z"/>
        <Path d="M210 185V163M359 163V140" stroke={GOLD} strokeWidth="1.4"/>
        <Path d="M207 218H215 M205 224H217 M357 191H364 M355 198H366"
          stroke={GOLD} strokeWidth="3"/>
        <Path d="M199 294V271Q210 248 225 271V294Z M340 294V269Q357 244 375 269V294Z"/>
        <Rect x="198" y="296" width="190" height="44"/>
      </G>
      <G opacity={dark?'.57':'.26'} fill="#EBD197">
        {Array.from({length:19},(_,i)=><Rect key={'window-'+i}
          x={220+i*9} y={304+(i%3)*8} width="2.6" height="4.2"/>)}
      </G>
      <G opacity={dark?'.24':'.2'} fill={silhouette}>
        <Path d="M0 325L0 310L19 310L19 295L36 295L36 320L55 305L70 311L70 330Z"/>
        <Path d="M70 329L70 301L91 301L91 293L111 293L111 322L127 307L142 315L142 330Z"/>
        <Path d="M112 308Q130 290 148 308V329H112Z"/>
        <Path d="M175 328L175 287L181 287L181 328Z"/>
      </G>
      <Rect x="0" y="341" width="390" height="125" fill="url(#fadingWater)"/>
      <G stroke={dark?'#E1BC7B':'#D9BA83'} strokeWidth="1" opacity={dark?'.19':'.16'}>
        {Array.from({length:26},(_,i)=><Line key={'ripple-'+i}
          x1={(i*67)%378} x2={Math.min(390,((i*67)%378)+11+(i%4)*8)}
          y1={348+(i*11)%94} y2={348+(i*11)%94}/>)}
      </G>
      {/* Low-opacity interlaced ornaments along the lower side of the screen. */}
      <G stroke={GOLD} strokeWidth=".9" opacity={dark?'.105':'.08'} fill="none">
        {Array.from({length:5},(_,i)=><G key={'side-'+i} transform={'translate('+(-17)+' '+(500+i*58)+')'}>
          <Path d="M0 -29L29 0L0 29L-29 0Z M0 -17L17 0L0 17L-17 0Z"/>
          <Circle r="23"/>
        </G>)}
        {Array.from({length:5},(_,i)=><G key={'side-r-'+i} transform={'translate(407 '+(475+i*58)+')'}>
          <Path d="M0 -29L29 0L0 29L-29 0Z M0 -17L17 0L0 17L-17 0Z"/>
          <Circle r="23"/>
        </G>)}
      </G>
    </Svg>
    <Image
      source={require('../../../assets/qibla/reference-istanbul-skyline.webp')}
      resizeMode="stretch"
      accessibilityIgnoresInvertColors
      style={{
        position:'absolute',right:-3,top:126,
        width:179,height:361,
        opacity:dark?.84:.15,
      }}/>
  </View>;
});

export const QiblaCompass=memo(function QiblaCompass({
  size,relative,heading,available,aligned,
}: {size:number;relative:number|null;heading:number|null;available:boolean;aligned:boolean}){
  const animatedAngle=useSharedValue(0);
  const lastAngle=useRef(0);
  useEffect(()=>{
    if(relative===null)return;
    const next=normalizeBearing(relative),previous=lastAngle.current;
    const step=((next-previous+540)%360)-180;
    lastAngle.current=previous+step;
    animatedAngle.value=withTiming(lastAngle.current,{
      duration:240,easing:Easing.out(Easing.cubic),
    });
  },[relative,animatedAngle]);
  const animatedStyle=useAnimatedStyle(()=>({
    transform:[{rotate: animatedAngle.value+'deg'}],
  }));
  const outer=available?'#FAE2A4':'#C6AC80';
  // True north labels move around the fixed bezel as the device rotates.
  // Letter glyphs remain upright for readability.
  const cardinalLabels=useMemo(()=>{
    if(heading===null||!available)return [];
    return ([
      {name:'K',worldAngle:0},
      {name:'D',worldAngle:90},
      {name:'G',worldAngle:180},
      {name:'B',worldAngle:270},
    ] as const).map(point=>{
      const radians=(point.worldAngle-heading)*Math.PI/180;
      return {
        ...point,
        x:180+114*Math.sin(radians),
        y:180-114*Math.cos(radians),
        outerX:180+149*Math.sin(radians),
        outerY:180-149*Math.cos(radians),
      };
    });
  },[heading,available]);
  // The complex gold bezel and 168 decorative tick/engraving groups are
  // static: updating the sensor does not reconstruct these React elements.
  const face=useMemo(()=>(
    <Svg width={size} height={size} viewBox={'0 0 '+DIAL+' '+DIAL}
      pointerEvents="none">
      <Defs>
        <RadialGradient id="qFace" cx="48%" cy="42%" rx="70%" ry="68%">
          <Stop offset="0%" stopColor="#155244"/>
          <Stop offset="55%" stopColor="#06362F"/>
          <Stop offset="83%" stopColor="#062A25"/>
          <Stop offset="100%" stopColor="#011C1C"/>
        </RadialGradient>
        <LinearGradient id="qGold" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#A57C3A"/>
          <Stop offset="22%" stopColor="#FFF0B6"/>
          <Stop offset="46%" stopColor="#B88945"/>
          <Stop offset="67%" stopColor="#F6CF7D"/>
          <Stop offset="100%" stopColor="#70502A"/>
        </LinearGradient>
        <RadialGradient id="qGlint" cx="45%" cy="34%" rx="63%" ry="70%">
          <Stop offset="0%" stopColor="#D3E0C4" stopOpacity=".18"/>
          <Stop offset="100%" stopColor="#D3E0C4" stopOpacity="0"/>
        </RadialGradient>
        <LinearGradient id="qStar" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#7AA59A"/>
          <Stop offset="48%" stopColor="#215D53"/>
          <Stop offset="100%" stopColor="#042824"/>
        </LinearGradient>
      </Defs>
      <Circle cx="180" cy="183" r="173" fill="#031B19" opacity=".38"/>
      <Circle cx="180" cy="180" r="173" fill="url(#qGold)" stroke="#F6DAA5" strokeWidth="1"/>
      <Circle cx="180" cy="180" r="167.5" fill="#0E4036" stroke="#45351F" strokeWidth="2"/>
      <Circle cx="180" cy="180" r="161" fill="url(#qGold)" stroke="#FAE2A4" strokeWidth=".9"/>
      <Circle cx="180" cy="180" r="152" fill="url(#qFace)" stroke="#654820" strokeWidth="2.1"/>
      {/* Filigree engravings along the outer gold bezel */}
      {Array.from({length:96},(_,i)=><G key={'engrave-'+i}
        transform={'rotate('+(i*3.75)+' 180 180)'} opacity={i%4===0?'.7':'.34'}>
        <Path d="M180 14L175 24L180 28L185 24Z" fill="none" stroke="#4C4834" strokeWidth=".65"/>
        <Line x1="180" y1="18" x2="180" y2="23" stroke="#FFF1BD" strokeWidth=".65"/>
      </G>)}
      <Circle cx="180" cy="180" r="143" fill="none" stroke="#CCA264" strokeWidth="1.2"/>
      <Circle cx="180" cy="180" r="137" fill="url(#qGlint)"/>
      {Array.from({length:72},(_,i)=><G key={'tick-'+i}
        transform={'rotate('+(i*5)+' 180 180)'}>
        <Line x1="180" y1={i%9===0?'41':'46'} x2="180"
          y2={i%9===0?'57':i%3===0?'56':'52'}
          stroke={i%9===0?'#FFEAB4':'#C6B78E'}
          strokeWidth={i%9===0?'2.3':i%3===0?'1.35':'.8'}
          opacity={i%9===0?'1':'.85'}/>
      </G>)}
      <Circle cx="180" cy="180" r="112" stroke="#A6AF8C" strokeOpacity=".18" fill="none"/>
      <Circle cx="180" cy="180" r="107" stroke="#D8CC9B" strokeOpacity=".12" fill="none"/>
      {/* Intricate, restrained Islamic eight-sided starwork on the face */}
      <G opacity=".18" stroke="#84B1A0" strokeWidth=".8" fill="none">
        {Array.from({length:8},(_,i)=><G key={'rose-'+i} transform={'rotate('+(i*45)+' 180 180)'}>
          <Path d="M180 89L191 157L180 180L169 157Z"/>
          <Path d="M180 91L212 130L180 164L148 130Z"/>
        </G>)}
        <Circle cx="180" cy="180" r="91"/>
        <Circle cx="180" cy="180" r="73"/>
      </G>
      {/* Faceted 8-point compass rose, same sculpted depth as the reference */}
      {Array.from({length:8},(_,i)=><G key={'facet-'+i}
        transform={'rotate('+(i*45)+' 180 180)'}>
        <Polygon points="180,88 164,166 180,180" fill="url(#qStar)" opacity={i%2===0?'.98':'.64'}/>
        <Polygon points="180,88 196,166 180,180" fill={i%2===0?'#4D8878':'#195648'} opacity=".83"/>
        <Path d="M180 88V180" fill="none" stroke="#D3E2B9" strokeWidth=".6" strokeOpacity=".38"/>
      </G>)}
      <Circle cx="180" cy="180" r="151" stroke="#FFF3CB" strokeOpacity=".16" fill="none"/>
    </Svg>
  ),[size]);
  return <View accessible accessibilityRole="image"
    accessibilityLabel={available&&relative!==null
      ?'Kıble yönü pusulada saat yönünde '+Math.round(relative)+' derece'
      :'Kıble pusulası yön verisi bekliyor'}
    style={{width:size,height:size,alignSelf:'center'}}>
    {face}
    <Svg width={size} height={size} viewBox={'0 0 '+DIAL+' '+DIAL}
      pointerEvents="none" style={StyleSheet.absoluteFill}>
      {cardinalLabels.map(label=><G key={label.name}>
        <Circle cx={label.outerX} cy={label.outerY} r="4.4"
          fill="#EBC77D" stroke="#74572D" strokeWidth=".7"/>
        <SvgText x={label.x} y={label.y+9} textAnchor="middle"
          fontSize="27" fontFamily="serif" fontWeight="700"
          fill="#FFF0D1" stroke="#624A2C" strokeWidth=".3">{label.name}</SvgText>
      </G>)}
    </Svg>
    {/* The needle is animated independently; the SVG bezel is never rerendered with heading ticks. */}
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill,animatedStyle]}>
      <Svg width={size} height={size} viewBox={'0 0 '+DIAL+' '+DIAL}>
        <Defs>
          <LinearGradient id="needleGlow" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#FFF7C9"/>
            <Stop offset="50%" stopColor="#F4C263"/>
            <Stop offset="100%" stopColor="#A97731"/>
          </LinearGradient>
        </Defs>
        {available?<G opacity={aligned?'1':'.94'}>
          <Path d="M180 199L167 180L180 73L192 180Z"
            fill="#F8CD6F" opacity=".12" stroke="#ECC77B" strokeWidth="2"/>
          <Path d="M180 195L175 181L180 78L187 181Z" fill="url(#needleGlow)"/>
          <Path d="M180 78L180 195" stroke="#FFFFFF" strokeWidth="1.3" strokeOpacity=".9"/>
          <KaabaSymbol x={180} y={58}/>
        </G>:null}
      </Svg>
    </Animated.View>
    {/* Metallic hub always sits atop the moving needle */}
    <Svg width={size} height={size} viewBox={'0 0 '+DIAL+' '+DIAL}
      pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id="qHub" cx="32%" cy="26%" rx="85%" ry="80%">
          <Stop offset="0%" stopColor="#FFEEB9"/>
          <Stop offset="55%" stopColor="#DBA856"/>
          <Stop offset="100%" stopColor="#6A4829"/>
        </RadialGradient>
      </Defs>
      <Circle cx="180" cy="180" r="19.6" fill="#2C271D" stroke="#F2DBA2" strokeWidth="3"/>
      <Circle cx="180" cy="180" r="15.5" fill="url(#qHub)" stroke="#583D22" strokeWidth="1.2"/>
      <Circle cx="175" cy="173" r="5.1" fill="#FFF4C9" opacity=".16"/>
      <Circle cx="180" cy="180" r="174" fill="none" stroke={outer} strokeOpacity=".2" strokeWidth="1"/>
    </Svg>
  </View>;
});

export function QiblaKaabaGlyph({size=32}: {size?:number}){
  return <Svg width={size} height={size} viewBox="0 0 44 44" pointerEvents="none">
    <Path d="M7 15L22 9L38 15L23 21Z" fill="#E8C479"/>
    <Path d="M7 15L23 21V38L7 31Z" fill="#26312D"/>
    <Path d="M23 21L38 15V31L23 38Z" fill="#0E191B"/>
    <Path d="M7 24L23 30L38 24M7 27L23 33L38 27"
      stroke="#E8BE69" strokeWidth="2" fill="none"/>
  </Svg>;
}
