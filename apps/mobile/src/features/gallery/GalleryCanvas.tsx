import {forwardRef,useMemo,type ComponentRef} from 'react';
import {
  Image,Platform,StyleSheet,Text,View,type ImageSourcePropType,
} from 'react-native';
import Svg,{Defs,LinearGradient,Stop,Rect,Path,Circle} from 'react-native-svg';
import type {GalleryDraft,GalleryFont,GalleryTextTone} from '@camideyiz/core';
import {galleryTextRelativeTop,galleryTextFitScale} from '@camideyiz/core';
import type {GallerySlot} from './galleryCatalog';

const TONES:Record<GalleryTextTone,string>={
  ivory:'#FFF7E9',white:'#FFFFFF',gold:'#F7D99B',dark:'#152C29',
};
const FONTS:Record<GalleryFont,string>=Platform.select({
  android:{serif:'serif',modern:'sans-serif',handwriting:'cursive',
    condensed:'sans-serif-condensed'},
  ios:{serif:'Georgia',modern:'AvenirNext-DemiBold',
    handwriting:'Snell Roundhand',condensed:'HelveticaNeue-CondensedBold'},
  default:{serif:'serif',modern:'sans-serif',handwriting:'cursive',
    condensed:'sans-serif-condensed'},
})!;

type Props={
  width:number;slot:GallerySlot;source:ImageSourcePropType|null;
  draft:GalleryDraft;onImageLoaded?:(loaded:boolean)=>void;
};

/** Same native View tree is used both for the user-facing preview and for
 * PNG capture. No separate CSS/HTML renderer, backend upload or hidden watermark.
 * The image is owner-provided, local-bundled and pixel-cropped to the selected
 * WhatsApp Story (9:16) / post (4:5) format.
 */
export const GalleryCanvas=forwardRef<ComponentRef<typeof View>,Props>(function GalleryCanvas({
  width,slot,source,draft,onImageLoaded,
},ref){
  const height=Math.round(width*(draft.format==='story'?16/9:5/4));
  const scale=width/360;
  const y=galleryTextRelativeTop(draft.position);
  const textStyle=useMemo(()=>{
    const fontSize=(draft.font==='condensed'?36:34)*scale*
      (draft.textSize==='small'?.8:draft.textSize==='large'?1.2:1)*
      galleryTextFitScale(draft.text);
    return {
      fontFamily:FONTS[draft.font],fontSize,
      lineHeight:fontSize*(draft.font==='handwriting'?1.36:1.2),
      color:TONES[draft.tone],
      fontWeight:(draft.font==='handwriting'?'500':'800') as '500'|'800',
      textShadowColor:draft.tone==='dark'?'rgba(255,255,255,.72)':'rgba(0,0,0,.8)',
      textShadowOffset:{width:0,height:2*scale},
      textShadowRadius:5*scale,
      textAlign:'center' as const,
      includeFontPadding:false,
    };
  },[draft.font,draft.tone,draft.textSize,draft.text,scale]);

  return <View ref={ref} collapsable={false} accessible
    accessibilityLabel={source
      ?slot.title+' görseli üzerine '+draft.text
      :'Fotoğraf henüz eklenmemiş şablon önizlemesi'}
    style={[styles.canvas,{width,height,backgroundColor:slot.accent}]}>
    {source?<Image source={source} resizeMode="cover"
      style={StyleSheet.absoluteFill}
      onLoad={()=>onImageLoaded?.(true)}
      onError={()=>onImageLoaded?.(false)}/>:<Svg width="100%" height="100%"
      viewBox="0 0 360 640" preserveAspectRatio="xMidYMid slice"
      style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs><LinearGradient id="placeholderShade" x1="0%" y1="0%"
        x2="80%" y2="100%">
        <Stop offset="0%" stopColor="#063E42" stopOpacity=".88"/>
        <Stop offset="65%" stopColor={slot.accent} stopOpacity=".9"/>
        <Stop offset="100%" stopColor="#092D2F" stopOpacity=".95"/>
      </LinearGradient></Defs>
      <Rect width="360" height="640" fill="url(#placeholderShade)"/>
      <Circle cx="180" cy="290" r="175" stroke="#F0D8A0"
        strokeOpacity=".18" fill="none"/>
      <Circle cx="180" cy="290" r="157" stroke="#F0D8A0"
        strokeOpacity=".13" fill="none"/>
      <Path d="M-50 125Q170 -35 410 125M-50 535Q170 680 410 535"
        stroke="#F7DFA9" strokeOpacity=".15" fill="none" strokeWidth="2"/>
    </Svg>}
    {/* Preserve room for WhatsApp's own Story top/bottom chrome. */}
    <View pointerEvents="none" style={[StyleSheet.absoluteFill,{
      backgroundColor:draft.shade==='light'?'rgba(0,0,0,.12)':
        draft.shade==='deep'?'rgba(0,0,0,.40)':'rgba(0,0,0,.25)',
    }]}/>
    <View pointerEvents="none" style={{
      position:'absolute',left:0,right:0,top:height*y,
      height:height*.45,transform:[{translateY:-height*.225}],
      justifyContent:'center',alignItems:'center',
      paddingHorizontal:width*.09,
    }}>
      <Text allowFontScaling={false} numberOfLines={9}
        adjustsFontSizeToFit minimumFontScale={.7}
        style={textStyle}>{draft.text}</Text>
    </View>
    {!source?<View pointerEvents="none" style={[styles.pending,{
      bottom:height*.09,left:width*.08,right:width*.08,
      borderRadius:11*scale,padding:10*scale,
    }]}>
      <Text allowFontScaling={false} style={{
        fontSize:12*scale,textAlign:'center',color:'#FFF7E6',
        fontWeight:'700',
      }}>FOTOĞRAF BEKLENİYOR · TASARIM ÖNİZLEMESİ</Text>
    </View>:null}
  </View>;
});
const styles=StyleSheet.create({
  canvas:{overflow:'hidden',borderRadius:12,position:'relative'},
  pending:{position:'absolute',backgroundColor:'rgba(0,24,25,.68)',
    borderWidth:1,borderColor:'rgba(255,224,167,.4)'},
});
