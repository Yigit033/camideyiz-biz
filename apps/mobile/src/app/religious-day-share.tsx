import {useRef,useState,type ComponentRef} from 'react';
import {
  ActivityIndicator,Alert,PixelRatio,Pressable,StyleSheet,Text,View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Feather} from '@expo/vector-icons';
import {router,useLocalSearchParams} from 'expo-router';
import {RELIGIOUS_DAYS,type GalleryFormat} from '@camideyiz/core';
import {useAppTheme} from '@/theme/ThemeProvider';
import {ReligiousDayCard} from '@/features/calendar/ReligiousDayCard';
import {CARD_WIDTH,cardLayout,type CardTone} from '@/features/calendar/religiousDayCardArt';
import {
  captureDesignPng,saveDesignPng,shareDesignPng,
} from '@/features/gallery/designExport';

const FORMATS:readonly {id:GalleryFormat;name:string;ratio:string}[]=[
  {id:'story',name:'Durum',ratio:'9:16'},
  {id:'post',name:'Gönderi',ratio:'4:5'},
];
const TONES:readonly {id:CardTone;name:string;swatch:string;ring:string}[]=[
  {id:'night',name:'Gece',swatch:'#0A2034',ring:'#D8BF8D'},
  {id:'ivory',name:'Gündüz',swatch:'#F7F1E4',ring:'#A88A5C'},
];

export default function ReligiousDayShareScreen(){
  const {colors}=useAppTheme();
  const {id}=useLocalSearchParams<{id?:string}>();
  const day=RELIGIOUS_DAYS.find(d=>d.id===id)??null;
  const cardRef=useRef<ComponentRef<typeof View>>(null);
  const [format,setFormat]=useState<GalleryFormat>('story');
  const [tone,setTone]=useState<CardTone>(colors.isDark?'night':'ivory');
  // The logo of the tone on screen must be drawn before any capture.
  const [loadedTone,setLoadedTone]=useState<CardTone|null>(null);
  const [busy,setBusy]=useState<'share'|'save'|null>(null);
  const [area,setArea]=useState<{width:number;height:number}|null>(null);

  // The card is laid out at exactly 1080 px wide on this screen's density, so
  // the PNG is drawn natively at export size; only the preview is scaled down
  // to fit, which never changes the captured pixels.
  const exportWidth=1080/PixelRatio.get();
  const exportHeight=Math.round(exportWidth*cardLayout(format).height/CARD_WIDTH);
  const scale=area?Math.min(1,area.width/exportWidth,area.height/exportHeight):0;
  const canExport=Boolean(day)&&loadedTone===tone&&!busy&&scale>0;

  const share=async()=>{
    if(!canExport)return;
    setBusy('share');
    try{
      await shareDesignPng(()=>captureDesignPng(cardRef,format));
    }catch(error){
      Alert.alert('Paylaşım açılamadı',
        error instanceof Error?error.message:'Görsel paylaşımı başlatılamadı.');
    }finally{setBusy(null);}
  };
  const save=async()=>{
    if(!canExport)return;
    setBusy('save');
    try{
      await saveDesignPng(()=>captureDesignPng(cardRef,format));
      Alert.alert('Kart kaydedildi',
        'Kart telefon galerine kaydedildi. WhatsApp > Güncellemeler > Durum bölümünden seçerek paylaşabilirsin.');
    }catch(error){
      Alert.alert('Kaydetme başarısız',
        error instanceof Error?error.message:'Kart galeriye kaydedilemedi.');
    }finally{setBusy(null);}
  };

  if(!day)return <SafeAreaView edges={['top','bottom']}
    style={[styles.missing,{backgroundColor:colors.canvas}]}>
    <Feather name="alert-circle" size={30} color={colors.gold}/>
    <Text style={{color:colors.text,textAlign:'center'}}>Bu gün bulunamadı.</Text>
    <Pressable accessibilityRole="button" onPress={()=>router.back()}
      style={{minHeight:44,justifyContent:'center'}}>
      <Text style={{color:colors.emerald,fontWeight:'800'}}>Dini günlere dön</Text>
    </Pressable>
  </SafeAreaView>;

  return <SafeAreaView edges={['top','bottom']}
    style={{flex:1,backgroundColor:colors.canvas}}>
    <View style={[styles.top,{borderBottomColor:colors.border}]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Geri dön"
        onPress={()=>router.back()}
        style={[styles.round,{borderColor:colors.border,backgroundColor:colors.surface}]}>
        <Feather name="arrow-left" color={colors.text} size={20}/>
      </Pressable>
      <View style={{flex:1,gap:3}}>
        <Text style={{fontFamily:'serif',fontSize:20,fontWeight:'800',color:colors.text}}>
          Paylaşım Kartı
        </Text>
        <Text numberOfLines={1} style={{fontSize:11,color:colors.muted}}>{day.title}</Text>
      </View>
    </View>

    <View style={styles.stage} onLayout={e=>{
      const {width,height}=e.nativeEvent.layout;
      setArea({width:Math.max(0,width-32),height:Math.max(0,height-28)});
    }}>
      {scale>0?<View style={[styles.frame,{
        width:exportWidth*scale,height:exportHeight*scale,
        backgroundColor:colors.surface,shadowColor:colors.isDark?'#000000':'#071725',
      }]}>
        <View style={{position:'absolute',width:exportWidth,height:exportHeight,
          left:(exportWidth*scale-exportWidth)/2,top:(exportHeight*scale-exportHeight)/2,
          transform:[{scale}]}}>
          <ReligiousDayCard ref={cardRef} day={day} format={format} tone={tone}
            width={exportWidth} onLogoLoaded={ok=>setLoadedTone(ok?tone:null)}/>
        </View>
        {/* Preview edge only; drawn over the card so it never shifts or clips it. */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill,styles.edge,
          {borderColor:colors.border}]}/>
      </View>:null}
    </View>

    <View style={styles.controls}>
      <View style={[styles.segment,{borderColor:colors.border,backgroundColor:colors.surface}]}
        accessibilityRole="radiogroup" accessibilityLabel="Kart oranı">
        {FORMATS.map(item=>{
          const on=format===item.id;
          return <Pressable key={item.id} accessibilityRole="radio"
            accessibilityState={{checked:on}}
            accessibilityLabel={item.name+' '+item.ratio}
            onPress={()=>setFormat(item.id)}
            style={[styles.option,{backgroundColor:on?colors.soft:'transparent',
              borderColor:on?colors.gold:'transparent'}]}>
            <Text style={{fontSize:12,fontWeight:'800',color:on?colors.text:colors.muted}}>
              {item.name}
            </Text>
            <Text style={{fontSize:10.5,fontWeight:'700',color:on?colors.gold:colors.muted}}>
              {item.ratio}
            </Text>
          </Pressable>;
        })}
      </View>
      <View style={[styles.segment,{borderColor:colors.border,backgroundColor:colors.surface}]}
        accessibilityRole="radiogroup" accessibilityLabel="Kart rengi">
        {TONES.map(item=>{
          const on=tone===item.id;
          return <Pressable key={item.id} accessibilityRole="radio"
            accessibilityState={{checked:on}} accessibilityLabel={item.name}
            onPress={()=>setTone(item.id)}
            style={[styles.option,{backgroundColor:on?colors.soft:'transparent',
              borderColor:on?colors.gold:'transparent'}]}>
            <View style={[styles.swatch,{backgroundColor:item.swatch,borderColor:item.ring}]}/>
            <Text style={{fontSize:12,fontWeight:'800',color:on?colors.text:colors.muted}}>
              {item.name}
            </Text>
          </Pressable>;
        })}
      </View>
    </View>

    <View style={[styles.footer,{borderTopColor:colors.border,backgroundColor:colors.surface}]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Kartı galeriye kaydet"
        accessibilityState={{disabled:!canExport,busy:busy==='save'}}
        onPress={()=>void save()} disabled={!canExport}
        style={[styles.secondary,{borderColor:colors.emerald,opacity:canExport||busy?1:.44}]}>
        {busy==='save'?<ActivityIndicator size="small" color={colors.emerald}/>
          :<Feather name="download" size={17} color={colors.emerald}/>}
        <Text style={{fontSize:12,fontWeight:'800',color:colors.emerald}}>Kaydet</Text>
      </Pressable>
      <Pressable accessibilityRole="button"
        accessibilityLabel="Kartı WhatsApp veya diğer uygulamalarla paylaş"
        accessibilityState={{disabled:!canExport,busy:busy==='share'}}
        onPress={()=>void share()} disabled={!canExport}
        style={[styles.primary,{backgroundColor:colors.accentStrong,
          opacity:canExport||busy?1:.44}]}>
        {busy==='share'?<ActivityIndicator size="small" color="#FFFFFF"/>
          :<Feather name="share-2" size={18} color="#FFFFFF"/>}
        <Text style={{fontSize:13,fontWeight:'800',color:'#FFFFFF'}}>Paylaş</Text>
      </Pressable>
    </View>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  missing:{flex:1,alignItems:'center',justifyContent:'center',padding:30,gap:12},
  top:{minHeight:63,borderBottomWidth:1,paddingHorizontal:16,paddingVertical:10,
    flexDirection:'row',gap:12,alignItems:'center'},
  round:{width:43,height:43,borderRadius:14,borderWidth:1,
    alignItems:'center',justifyContent:'center'},
  stage:{flex:1,minHeight:160,alignItems:'center',justifyContent:'center'},
  frame:{overflow:'hidden',borderRadius:14,
    shadowOpacity:.22,shadowRadius:14,shadowOffset:{width:0,height:6},elevation:6},
  edge:{borderRadius:14,borderWidth:1},
  controls:{paddingHorizontal:14,paddingTop:2,paddingBottom:4,
    flexDirection:'row',flexWrap:'wrap',gap:8},
  segment:{flexGrow:1,flexBasis:150,flexDirection:'row',borderWidth:1,
    borderRadius:14,padding:3,gap:3},
  option:{flex:1,minHeight:44,borderRadius:11,borderWidth:1,paddingHorizontal:6,
    paddingVertical:5,flexDirection:'row',flexWrap:'wrap',alignItems:'center',
    justifyContent:'center',columnGap:6},
  swatch:{width:16,height:16,borderRadius:8,borderWidth:1.5},
  footer:{borderTopWidth:1,paddingHorizontal:15,paddingVertical:12,
    flexDirection:'row',gap:9,marginTop:8},
  secondary:{flex:1,minHeight:49,borderWidth:1.5,borderRadius:14,
    flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},
  primary:{flex:1.4,minHeight:49,borderRadius:14,
    flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
});
