import {memo} from 'react';
import {View, useWindowDimensions} from 'react-native';
import Svg, {
  Circle, Defs, Ellipse, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop,
} from 'react-native-svg';

/** Vector scenery: independent art, not a screenshot of the design reference. */
export const MosqueLandscape = memo(function MosqueLandscape({
  width, dark,
}: {width: number; dark: boolean}) {
  const height = width * 0.48;
  const gold = dark ? '#D6C29A' : '#A58B66';
  const silhouette = dark ? '#0C6B67' : '#678A77';
  return <Svg width={width} height={height} viewBox="0 0 220 106" pointerEvents="none">
    <Defs>
      <LinearGradient id="mSky" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor={dark ? '#1C8C84' : '#96C7CF'} stopOpacity={dark ? '.12' : '.3'}/>
        <Stop offset="72%" stopColor={dark ? '#207E77' : '#E1D4B4'} stopOpacity=".13"/>
        <Stop offset="100%" stopColor={dark ? '#073B38' : '#FFFFFF'} stopOpacity="0"/>
      </LinearGradient>
      <RadialGradient id="mHalo" cx="50%" cy="39%" rx="48%" ry="60%">
        <Stop offset="0%" stopColor={dark ? '#B4CFA2' : '#E5C387'} stopOpacity=".23"/>
        <Stop offset="100%" stopColor="#E7D4A5" stopOpacity="0"/>
      </RadialGradient>
      <LinearGradient id="mArchitecture" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor={gold}/>
        <Stop offset="100%" stopColor={silhouette}/>
      </LinearGradient>
    </Defs>
    <Rect x="0" y="0" width="220" height="106" fill="url(#mSky)"/>
    <Ellipse cx="110" cy="45" rx="94" ry="60" fill="url(#mHalo)"/>
    <Circle cx="165" cy="22" r="8" fill={gold} opacity={dark ? '.16' : '.2'}/>
    <Path d="M0 77Q18 63 34 72T64 72T95 75T125 70T155 73T183 67T220 75V106H0Z"
      fill={dark ? '#073D3B' : '#A5B6A6'} opacity=".27"/>
    <Path d="M30 92L33 54H37L40 92M33 54L35 44L37 54 M183 92L186 54H190L193 92M186 54L188 44L190 54"
      stroke="url(#mArchitecture)" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <Path d="M49 85V50H55L58 40L61 50H67V85M153 85V50H159L162 40L165 50H171V85"
      fill="url(#mArchitecture)" opacity=".88"/>
    <Path d="M84 84V62Q110 35 136 62V84ZM77 64Q110 26 143 64"
      fill="url(#mArchitecture)" stroke={gold} strokeWidth="1" strokeOpacity=".8"/>
    <Path d="M106 37Q110 26 114 37M110 28V22M107 22Q113 25 116 19"
      fill="none" stroke={gold} strokeWidth="1.7" strokeLinecap="round"/>
    <Rect x="74" y="76" width="72" height="13" rx="1.4" fill={silhouette}/>
    <Path d="M88 89V76Q94 70 100 76V89M103 89V75Q110 66 117 75V89M120 89V76Q126 70 132 76V89"
      fill={dark ? '#0A292B' : '#F8F4E8'} opacity=".56"/>
    <Path d="M14 94Q47 86 82 94T150 94T215 92" fill="none" stroke={gold} strokeOpacity=".25" strokeWidth="1"/>
    <Line x1="0" y1="98" x2="220" y2="98" stroke={gold} strokeOpacity=".24" strokeWidth="1"/>
  </Svg>;
});

/** Architectural atmosphere across the entire scrolling screen, intentionally low contrast. */
export const Atmosphere = memo(function Atmosphere({dark}: {dark:boolean}) {
  const {width} = useWindowDimensions();
  return <View pointerEvents="none" style={{position:'absolute',left:0,top:0,width,height:960}}>
    <Svg width="100%" height="100%" viewBox="0 0 390 960" preserveAspectRatio="xMidYMin slice">
      <Defs>
        <LinearGradient id="pageWash" x1="0%" y1="0%" x2="80%" y2="100%">
          <Stop offset="0%" stopColor={dark ? '#041519' : '#F9F7F2'}/>
          <Stop offset="56%" stopColor={dark ? '#082725' : '#F6F3EE'}/>
          <Stop offset="100%" stopColor={dark ? '#0B1C20' : '#EDE9E2'}/>
        </LinearGradient>
        <RadialGradient id="ambientTop" cx="50%" cy="18%" rx="62%" ry="48%">
          <Stop offset="0%" stopColor={dark ? '#1A7470' : '#FFFDF6'} stopOpacity={dark ? '.23' : '.79'}/>
          <Stop offset="100%" stopColor={dark ? '#092325' : '#FFFFFF'} stopOpacity="0"/>
        </RadialGradient>
      </Defs>
      <Rect width="390" height="960" fill="url(#pageWash)"/>
      <Rect width="390" height="680" fill="url(#ambientTop)"/>
      {Array.from({length:8},(_,i)=>{
        const shift=i*30;
        return <Path key={i} d={'M'+(shift-100)+' -25 Q'+(shift+130)+' 115 '+(shift-100)+' 302'}
          fill="none" stroke={dark ? '#C9A875' : '#B7A077'} strokeOpacity={dark?'.053':'.065'} strokeWidth=".7"/>;
      })}
      <G opacity={dark?'.065':'.09'} fill="none" stroke={dark?'#E7BE83':'#AD9575'} strokeWidth=".8">
        <Circle cx="-24" cy="360" r="155"/><Circle cx="-24" cy="360" r="189"/>
        <Circle cx="423" cy="630" r="170"/><Circle cx="423" cy="630" r="199"/>
      </G>
    </Svg>
  </View>;
});

/** Delicate Islamic geometric filigree for the cards, drawn instead of baked in an image. */
export const ArabesqueCorner = memo(function ArabesqueCorner({
  dark, width=125,
}: {dark:boolean;width?:number}) {
  return <Svg pointerEvents="none" width={width} height={width} viewBox="0 0 120 120"
    style={{position:'absolute',right:-7,top:-6,opacity:dark?.36:.32}}>
    <G stroke={dark?'#D6B577':'#A98A53'} fill="none" strokeWidth=".8">
      <Path d="M62 -20L130 48L62 116L-6 48Z"/>
      <Path d="M62 0L110 48L62 96L14 48Z"/>
      <Path d="M62 16L94 48L62 80L30 48Z"/>
      <Circle cx="62" cy="48" r="33"/>
      <Circle cx="62" cy="48" r="17"/>
      <Path d="M62 14V82M28 48H96M39 25L85 71M39 71L85 25"/>
      <Path d="M0 70Q40 88 52 120M110 0Q91 39 120 61"/>
    </G>
  </Svg>;
});

export const GoldenLantern = memo(function GoldenLantern({size=44}: {size?:number}) {
  return <Svg width={size} height={size*1.35} viewBox="0 0 44 60">
    <Defs>
      <RadialGradient id="lanternGlow">
        <Stop offset="0" stopColor="#FFE4A8" stopOpacity=".74"/>
        <Stop offset="1" stopColor="#F1B66D" stopOpacity="0"/>
      </RadialGradient>
      <LinearGradient id="lanternGold" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#F9DDA0"/><Stop offset="100%" stopColor="#A77732"/>
      </LinearGradient>
    </Defs>
    <Circle cx="22" cy="34" r="22" fill="url(#lanternGlow)"/>
    <Path d="M22 0V8M17 8H27M22 8V13M12 20L22 14L32 20V42L22 50L12 42Z"
      stroke="url(#lanternGold)" strokeWidth="2.5" fill="#E4B86A" fillOpacity=".22"/>
    <Path d="M12 24H32M12 39H32M22 20V43M16 20L28 43M28 20L16 43"
      stroke="#F9D99D" strokeWidth="1"/>
    <Path d="M18 52H26M21 52V58M18 58H26" stroke="#C79853" strokeWidth="2"/>
  </Svg>;
});


/** Transparent, scalable architectural emblem for the prayer dial medallion.
 * Unlike the older scene images this has NO rectangle/background image and blends
 * cleanly into light and dark central medallions at any phone pixel density.
 */
export const MosqueCrest = memo(function MosqueCrest({width,dark}:{width:number;dark:boolean}){
  const gold=dark?'#DCC48C':'#AF905C';
  const sage=dark?'#1C9888':'#719D86';
  const shadow=dark?'#0B3939':'#D9CBA8';
  return <Svg width={width} height={width*0.52} viewBox="0 0 240 125" pointerEvents="none">
    <Defs>
      <RadialGradient id="crestGlow" cx="50%" cy="45%" rx="53%" ry="53%">
        <Stop offset="0%" stopColor={dark?'#4FCAB1':'#E8C48C'} stopOpacity={dark?'.28':'.42'}/>
        <Stop offset="72%" stopColor={dark?'#10766D':'#E8D6AB'} stopOpacity=".08"/>
        <Stop offset="100%" stopColor="#E8D6AB" stopOpacity="0"/>
      </RadialGradient>
      <LinearGradient id="crestGold" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor={dark?'#FAE7B8':'#D8B878'}/>
        <Stop offset="50%" stopColor={gold}/>
        <Stop offset="100%" stopColor={dark?'#886B4D':'#8A714F'}/>
      </LinearGradient>
      <LinearGradient id="crestDome" x1="0%" y1="0%" x2="0%" y2="100%">
        <Stop offset="0%" stopColor={dark?'#75C9B9':'#A7C7AD'}/>
        <Stop offset="52%" stopColor={sage}/>
        <Stop offset="100%" stopColor={shadow}/>
      </LinearGradient>
      <LinearGradient id="crestHorizon" x1="0%" y1="0%" x2="0%" y2="100%">
        <Stop offset="0%" stopColor={dark?'#3A8A7C':'#B5C5A9'} stopOpacity=".31"/>
        <Stop offset="100%" stopColor={dark?'#062928':'#F8F2E3'} stopOpacity="0"/>
      </LinearGradient>
    </Defs>
    <Ellipse cx="120" cy="77" rx="105" ry="65" fill="url(#crestGlow)"/>
    <Path d="M0 116 Q30 105 57 113 T119 113 T185 109 T240 115 V125 H0Z"
      fill="url(#crestHorizon)"/>
    {Array.from({length:9},(_,i)=>{
      const x=27+i*23, y=[43,30,39,24,34,23,39,31,41][i];
      return <Circle key={i} cx={x} cy={y} r={i%3===0?1.15:.65}
        fill={gold} opacity={dark?.57:.38}/>;
    })}
    {/* Slender twin minarets and their balconies */}
    {[52,187].map((x,i)=><G key={i}>
      <Path d={'M'+(x-5)+' 109 L'+(x-3.7)+' 43 L'+(x+3.7)+' 43 L'+(x+5)+' 109Z'}
        fill="url(#crestGold)" opacity=".9"/>
      <Path d={'M'+(x-7)+' 59 H'+(x+7)+' M'+(x-7)+' 66 H'+(x+7)}
        stroke={gold} strokeWidth="1.8"/>
      <Path d={'M'+(x-3.7)+' 43 Q'+x+' 27 '+(x+3.7)+' 43'}
        fill={dark?'#A2BA96':'#9EBDA8'} stroke={gold} strokeWidth="1.1"/>
      <Path d={'M'+x+' 31V25 M'+x+' 26 L'+(x+2)+' 24'}
        stroke={gold} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <Rect x={x-6.5} y="95" width="13" height="13" fill={shadow} opacity=".3"/>
    </G>)}
    {/* smaller outer domes give architectural depth */}
    <G opacity=".86">
      <Path d="M63 109V80Q74 58 85 80V109Z M154 109V80Q166 58 177 80V109Z"
        fill="url(#crestDome)" stroke={gold} strokeWidth="1.1"/>
      <Path d="M74 72V65 M166 72V65" stroke={gold} strokeWidth="1.5"/>
    </G>
    {/* central dome: turquoise in dark mode, pale sage in light mode */}
    <Path d="M84 109V72 Q120 25 156 72V109Z" fill="url(#crestDome)"
      stroke="url(#crestGold)" strokeWidth="2"/>
    <Path d="M91 74Q120 40 149 74" fill="none" stroke={gold}
      strokeWidth="1.2" opacity=".65"/>
    <Rect x="79" y="91" width="82" height="19" rx="1.5" fill={shadow}/>
    <Path d="M104 110V91Q120 72 136 91V110Z" fill={dark?'#092E31':'#F4EAD8'}
      stroke={gold} strokeWidth="1.25"/>
    <Path d="M120 48V33" stroke={gold} strokeWidth="1.7" strokeLinecap="round"/>
    <Path d="M120 30C117 26 120 20 125 21 C121 23 121 27 128 28 C125 32 121 32 120 30Z"
      fill="url(#crestGold)"/>
    <Path d="M34 109H206" stroke={gold} strokeWidth="1" opacity=".35"/>
    <Path d="M27 113 Q120 102 213 113" stroke={gold} strokeWidth="1" fill="none" opacity=".35"/>
  </Svg>;
});
