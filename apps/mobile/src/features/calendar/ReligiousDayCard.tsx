import {forwardRef,memo,useMemo,type ComponentRef} from 'react';
import {Image,Platform,StyleSheet,Text,View} from 'react-native';
import Svg,{Defs,LinearGradient,Path,RadialGradient,Stop} from 'react-native-svg';
import {
  fitHeadline,religiousDayShareCopy,turkishUpper,
  type GalleryFormat,type ReligiousDay,
} from '@camideyiz/core';
import {
  CARD_PALETTE,CARD_WIDTH,LOGO_ASPECT,cardArt,cardLayout,headlineBox,
  type CardTone,
} from './religiousDayCardArt';

/** Transparent brand marks: cyan on midnight, deep azure on ivory. No box. */
const MARKS={
  dark:require('../../../assets/widget-mark-dark.png') as number,
  light:require('../../../assets/widget-mark-light.png') as number,
};
const SERIF=Platform.select({ios:'Georgia',default:'serif'});

type Props={
  day:ReligiousDay;format:GalleryFormat;tone:CardTone;
  /** Layout width in dp; every measure scales from the 360-unit grid. */
  width:number;
  onLogoLoaded?:(loaded:boolean)=>void;
};

const CardArtwork=memo(function CardArtwork({format,tone,motif,width,height}:{
  format:GalleryFormat;tone:CardTone;motif:ReturnType<typeof religiousDayShareCopy>['motif'];
  width:number;height:number;
}){
  const art=useMemo(()=>cardArt(format,tone,motif),[format,tone,motif]);
  return <Svg width={width} height={height} viewBox={'0 0 '+art.width+' '+art.height}
    style={StyleSheet.absoluteFill} pointerEvents="none">
    <Defs>
      {art.gradients.map(g=>g.type==='linear'
        ?<LinearGradient key={g.id} id={g.id} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2}>
          {g.stops.map(s=><Stop key={s.offset} offset={s.offset} stopColor={s.color}
            stopOpacity={s.opacity}/>)}
        </LinearGradient>
        :<RadialGradient key={g.id} id={g.id} cx={g.cx} cy={g.cy} r={g.r}>
          {g.stops.map(s=><Stop key={s.offset} offset={s.offset} stopColor={s.color}
            stopOpacity={s.opacity}/>)}
        </RadialGradient>)}
    </Defs>
    {art.shapes.map((s,i)=><Path key={i} d={s.d} fill={s.fill??'none'}
      fillOpacity={s.fillOpacity} stroke={s.stroke} strokeWidth={s.strokeWidth}
      strokeOpacity={s.strokeOpacity} strokeLinecap="round"/>)}
  </Svg>;
});

/** The branded religious-day card. The same native tree is the on-screen
 * preview and the captured PNG; its text never follows the system font size,
 * so the exported image is identical on every phone.
 */
export const ReligiousDayCard=forwardRef<ComponentRef<typeof View>,Props>(function ReligiousDayCard({
  day,format,tone,width,onLogoLoaded,
},ref){
  const copy=useMemo(()=>religiousDayShareCopy(day),[day]);
  const layout=useMemo(()=>cardLayout(format),[format]);
  const {lines,fontSize}=useMemo(()=>fitHeadline(copy.headline,headlineBox(layout)),
    [copy.headline,layout]);
  const palette=CARD_PALETTE[tone];
  const s=width/CARD_WIDTH;
  const height=Math.round(width*layout.height/CARD_WIDTH);
  const headline=fontSize*s;
  const box=(top:number,h:number)=>({position:'absolute' as const,left:0,right:0,
    top:top*s,height:h*s,justifyContent:'center' as const,alignItems:'center' as const});
  const logoHeight=layout.logo.height*s;
  const logoWidth=logoHeight*LOGO_ASPECT;
  return <View ref={ref} collapsable={false} accessible accessibilityRole="image"
    accessibilityLabel={copy.eyebrow+'. '+copy.headline+'. '+copy.hijri+', '+
      copy.gregorian+'. '+copy.blessing+'. camideyiz.biz'}
    style={{width,height,overflow:'hidden',backgroundColor:palette.bgMid}}>
    <CardArtwork format={format} tone={tone} motif={copy.motif} width={width} height={height}/>
    <View pointerEvents="none" style={box(layout.eyebrow.top,layout.eyebrow.height)}>
      <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit
        minimumFontScale={.7} style={{fontSize:layout.eyebrow.fontSize*s,
          letterSpacing:2.3*s,fontWeight:'700',color:palette.goldText,
          includeFontPadding:false,textAlign:'center'}}>
        {turkishUpper(copy.eyebrow)}
      </Text>
    </View>
    <View pointerEvents="none" style={[box(layout.headline.top,layout.headline.height),{
      left:layout.headline.inset*s,right:layout.headline.inset*s}]}>
      <Text allowFontScaling={false} numberOfLines={lines.length} adjustsFontSizeToFit
        minimumFontScale={.72} style={{fontFamily:SERIF,fontWeight:'700',
          fontSize:headline,lineHeight:headline*1.18,color:palette.headline,
          textAlign:'center',includeFontPadding:false}}>
        {lines.join('\n')}
      </Text>
    </View>
    <View pointerEvents="none" style={box(layout.hijri.top,layout.hijri.height)}>
      <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit
        minimumFontScale={.75} style={{fontFamily:SERIF,fontWeight:'700',
          fontSize:layout.hijri.fontSize*s,color:palette.goldText,includeFontPadding:false}}>
        {copy.hijri}
      </Text>
    </View>
    <View pointerEvents="none" style={box(layout.gregorian.top,layout.gregorian.height)}>
      <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit
        minimumFontScale={.75} style={{fontSize:layout.gregorian.fontSize*s,
          fontWeight:'600',letterSpacing:.3*s,color:palette.muted,includeFontPadding:false}}>
        {copy.gregorian}
      </Text>
    </View>
    <View pointerEvents="none" style={box(layout.blessing.top,layout.blessing.height)}>
      <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit
        minimumFontScale={.75} style={{fontFamily:SERIF,fontStyle:'italic',
          fontSize:layout.blessing.fontSize*s,color:palette.blessing,includeFontPadding:false}}>
        {copy.blessing}
      </Text>
    </View>
    <Image key={palette.logo} source={MARKS[palette.logo]} resizeMode="contain"
      fadeDuration={0} accessibilityIgnoresInvertColors
      onLoad={()=>onLogoLoaded?.(true)} onError={()=>onLogoLoaded?.(false)}
      style={{position:'absolute',top:layout.logo.top*s,left:(width-logoWidth)/2,
        width:logoWidth,height:logoHeight}}/>
  </View>;
});
