import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {
  ActivityIndicator,Alert,Linking,Pressable,ScrollView,StyleSheet,
  Text,View,useWindowDimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from 'expo-router';
import {activateKeepAwakeAsync,deactivateKeepAwake} from 'expo-keep-awake';
import {Feather,MaterialCommunityIcons} from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg,{Defs,LinearGradient,Rect,Stop} from 'react-native-svg';
import {qiblaGuidance} from '@camideyiz/core';
import {useAppTheme} from '@/theme/ThemeProvider';
import {QiblaBackdrop,QiblaCalibrationGuide,QiblaCompass,QiblaKaabaGlyph}
  from '@/features/qibla/QiblaArtwork';
import {useQiblaEngine,type CompassAccuracy} from '@/features/qibla/useQiblaEngine';

const KEEP_AWAKE_TAG='camideyiz-qibla';
const distanceFormat=new Intl.NumberFormat('tr-TR',{maximumFractionDigits:0});

const KAABA_MAP_URL='https://www.google.com/maps/search/?api=1&query=21.4225%2C39.8262';
const GOLD='#EDCE8A';

function statusName(value:CompassAccuracy|null){
  switch(value){
    case 3:return 'Yüksek';
    case 2:return 'Orta';
    case 1:return 'Düşük';
    case 0:return 'Güvenilmez';
    default:return 'Bekleniyor';
  }
}
function GoldButtonBackground(){
  return <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 245 60"
    preserveAspectRatio="none" pointerEvents="none">
    <Defs>
      <LinearGradient id="qButton" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#F9E5AB"/>
        <Stop offset="33%" stopColor="#D7AD64"/>
        <Stop offset="58%" stopColor="#F6D995"/>
        <Stop offset="100%" stopColor="#B98E48"/>
      </LinearGradient>
    </Defs>
    <Rect x="0" y="0" width="245" height="60" fill="url(#qButton)"/>
    <Rect x="1" y="1" width="243" height="58" rx="15" stroke="#FFF0C3" strokeOpacity=".65" fill="none"/>
  </Svg>;
}
export default function QiblaScreen(){
  const {colors}=useAppTheme();
  const {width}=useWindowDimensions();
  const dark=colors.isDark;
  const {bearing,heading,compassAccuracy,freshness,locationAccuracy,
    locationLabel,distanceKm,positionSource,positionUsable,permissionDenied,busy,message,
    tilt,interference,errorDegrees,needleAngle,northAngle,
    requestLocation,recalibrateHeading}=useQiblaEngine();
  const [showGuide,setShowGuide]=useState(false);
  const lastAlignedHaptic=useRef(0);
  // A compass is used while standing still and reading: keep the screen on
  // only while this tab is focused.
  useFocusEffect(useCallback(()=>{
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(()=>undefined);
    return()=>{deactivateKeepAwake(KEEP_AWAKE_TAG).catch(()=>undefined);};
  },[]));
  const compassSize=Math.min(Math.max(255,width-42),352);
  // Brand semantics: success is the logo cyan in dark mode, emerald in light.
  const SUCCESS=dark?'#7FD8F7':'#2E8B5E';
  const ON_GOLD=dark?'#0B2A44':'#16382B';
  const locationReady=bearing!==null&&positionUsable;
  const disturbed=interference==='interference';
  // A historical angle may remain visible, but it must never be actionable.
  // Held upright the phone's top edge has no horizontal direction at all.
  const hasValidHeading=freshness==='live'&&locationReady&&heading!==null&&
    compassAccuracy!==null&&compassAccuracy>=2&&tilt!=='upright';
  const guidance=useMemo(()=>hasValidHeading&&bearing!==null&&heading!==null
    ?qiblaGuidance(bearing,heading):null,[hasValidHeading,bearing,heading]);
  // "Aligned" (green + haptic) only when every signal is trustworthy.
  const aligned=guidance?.direction==='near'&&compassAccuracy===3&&
    !disturbed&&tilt==='flat';
  const needsCalibration=showGuide||disturbed||
    (locationReady&&freshness==='live'&&compassAccuracy!==null&&compassAccuracy<=1);

  useEffect(()=>{
    if(!aligned)return;
    // Require a stable alignment, not a momentary noisy 7-degree crossing.
    const hold=setTimeout(()=>{
      if(Date.now()-lastAlignedHaptic.current<12000)return;
      lastAlignedHaptic.current=Date.now();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>undefined);
    },650);
    return()=>clearTimeout(hold);
  },[aligned]);

  const primaryAction=()=>{
    if(!locationReady){void requestLocation(true);return;}
    setShowGuide(true);
    recalibrateHeading();
    Haptics.selectionAsync().catch(()=>undefined);
  };
  const openMap=async()=>{
    try{await Linking.openURL(KAABA_MAP_URL);}
    catch{Alert.alert('Harita açılamadı','Kâbe konumunu açmak için tarayıcı ayarlarını kontrol et.');}
  };
  // Relative live turn guidance is the primary instruction. Absolute bearing is
  // shown only as a labelled reference, never presented as a turn instruction.
  const turnInstruction=!locationReady?'Konum bekleniyor'
    :freshness!=='live'?'Pusula sinyali bekleniyor'
    :tilt==='upright'?'Telefonu yere paralel tut'
    :compassAccuracy===1?'Önce pusulayı kalibre et'
    :!guidance?'Pusula yönü bekleniyor'
    :guidance.direction==='near'
      ?aligned?'Kıble doğrultusundasın':'Doğrultuya yakın · kalibre et'
      :guidance.direction==='right'?'Sağa '+guidance.turnDegrees+'° dön'
      :'Sola '+guidance.turnDegrees+'° dön';
  const absoluteBearingText=bearing===null
    ?'Kâbe açısı konum alındığında hesaplanır'
    :'Kâbe '+Math.round(bearing)+'° · gerçek kuzeye göre'+
      (distanceKm!==null?' · '+distanceFormat.format(distanceKm)+' km':'')+
      (positionSource==='last-known'?' · son bilinen konum':'')+
      (!positionUsable?' · güncellenmeli':'');
  const headingStatus=!locationReady?
      (bearing===null?'Konumunu etkinleştir':'Konum güncellenmeli')
    :freshness==='recovering'?'Pusula yeniden bağlanıyor'
    :freshness==='stale'?'Pusula verisi bekleniyor'
    :tilt==='upright'?'Telefonu yatay tut'
    :disturbed?'Manyetik parazit algılandı'
    :compassAccuracy===1?'Kalibrasyon gerekli'
    :!hasValidHeading?'Pusula sinyali bekleniyor'
    :aligned?'Kıble doğrultusundasın'
    :tilt==='tilted'?'Telefonu biraz daha yatay tut'
    :guidance?.direction==='near'?'Sensör doğruluğunu artır'
    :'İbreyi takip ederek yönel';
  const detailMessage=disturbed
    ?'Yakında mıknatıs ya da metal var (hoparlör, manyetik kılıf, laptop, demir masa). Uzaklaşıp 8 hareketi yap; ibre bu sırada sapabilir.'
    :tilt==='upright'
      ?'Pusula telefonun üst kenarını kullanır; telefon dik tutulduğunda yön ölçülemez.'
      :compassAccuracy===1&&freshness==='live'
        ?'Pusula sinyali düşük. Metal eşyalardan uzaklaş ve cihazı kalibre et.'
        :message;
  const precisionText=errorDegrees!==null?' · ±'+errorDegrees+'°':'';
  return <SafeAreaView edges={['top']} style={{flex:1,backgroundColor:dark?'#06192C':colors.canvas}}>
    <QiblaBackdrop dark={dark}/>
    <ScrollView showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content,{paddingHorizontal:Math.max(14,Math.min(22,width*.045))}]}>
      <View style={styles.brand}>
        <View style={{width:30,height:1,backgroundColor:colors.gold,opacity:.65}}/>
        <MaterialCommunityIcons name="mosque" size={21} color={colors.gold}/>
        <Text style={{fontFamily:'serif',fontStyle:'italic',fontSize:21,color:colors.text}}>
          Camideyiz Biz
        </Text>
        <View style={{width:30,height:1,backgroundColor:colors.gold,opacity:.65}}/>
      </View>
      <View style={styles.headline}>
        <View style={styles.eyebrow}>
          <View style={[styles.rule,{backgroundColor:colors.gold}]}/>
          <Text style={{fontWeight:'800',color:colors.gold,fontSize:10,letterSpacing:4}}>KIBLE</Text>
          <View style={[styles.rule,{backgroundColor:colors.gold}]}/>
        </View>
        <Text style={{fontFamily:'serif',fontSize:42,letterSpacing:-1.1,
          fontWeight:'700',color:colors.text,textShadowColor:dark?'#0A2742':'transparent',
          textShadowRadius:8}}>
          Kıble
        </Text>
      </View>
      <View style={{marginTop:4,marginBottom:0}}>
        <QiblaCompass size={compassSize} dark={dark}
          needleAngle={needleAngle} northAngle={northAngle}
          available={hasValidHeading} aligned={aligned}/>
      </View>

      <View style={[styles.status,{
        backgroundColor:dark?'rgba(12,45,68,.93)':'rgba(255,253,243,.93)',
        borderColor:hasValidHeading?GOLD:colors.border,
        shadowColor:hasValidHeading?'#DAB56A':'transparent',
        shadowOpacity:hasValidHeading?.27:0,shadowRadius:13,
      }]}>
        <Feather name={aligned?'check-circle':disturbed||tilt==='upright'?'alert-triangle'
          :locationReady?'compass':'map-pin'}
          size={20} color={aligned?SUCCESS:disturbed?'#E8A16B':colors.gold}/>
        <Text style={{color:colors.text,fontFamily:'serif',fontSize:17,
          fontWeight:'700'}}>{headingStatus}</Text>
      </View>
      <View style={[styles.anglePlaque,{
        borderColor:colors.gold,
        backgroundColor:dark?'rgba(10,49,75,.90)':'rgba(255,252,240,.89)',
      }]}>
        <View style={styles.guidanceRow}>
          <Feather name={guidance?.direction==='right'?'rotate-cw'
            :guidance?.direction==='left'?'rotate-ccw'
            :aligned?'check-circle':'compass'}
            size={22} color={colors.gold}/>
          <Text adjustsFontSizeToFit numberOfLines={1} minimumFontScale={.68}
            accessibilityLabel={turnInstruction}
            style={{fontFamily:'serif',fontWeight:'700',color:colors.text,
              fontSize:25,letterSpacing:-.4,flexShrink:1,textAlign:'center'}}>
            {turnInstruction}
          </Text>
          <QiblaKaabaGlyph size={30}/>
        </View>
        <View style={styles.azimuthRow}>
          <View style={[styles.goldDiamond,{backgroundColor:colors.gold}]}/>
          <Text style={{color:colors.muted,fontSize:11,fontWeight:'600',textAlign:'center',flexShrink:1}}>
            {absoluteBearingText}
          </Text>
          <View style={[styles.goldDiamond,{backgroundColor:colors.gold}]}/>
        </View>
      </View>

      <View style={[styles.locationCard,{
        backgroundColor:dark?'rgba(11,54,80,.93)':'rgba(255,254,247,.9)',
        borderColor:dark?'#467E9D':colors.border,
      }]}>
        <MaterialCommunityIcons name="map-marker" size={30} color={GOLD}/>
        <View style={{flex:1,gap:5,minWidth:0}}>
          <Text numberOfLines={1} style={{color:colors.text,fontFamily:'serif',fontSize:19,fontWeight:'700'}}>
            {locationLabel}
          </Text>
          <Text numberOfLines={2} style={{color:colors.muted,fontSize:11,lineHeight:17}}>
            {locationReady?'Konum alındı':bearing!==null?'Konum güncellenmeli':'Konum izni bekleniyor'}
            {locationAccuracy!==null&&locationReady?' (±'+Math.round(locationAccuracy)+' m)':''}
            {'  ·  Pusula: '+(disturbed?'Parazit':statusName(compassAccuracy))+precisionText}
          </Text>
        </View>
        <View accessible accessibilityLabel={'Pusula hassasiyeti '+
            (errorDegrees!==null?'artı eksi '+errorDegrees+' derece':statusName(compassAccuracy))}
          style={[styles.sensorBadge,{borderColor:disturbed?'#E8A16B':colors.isDark?'#4696BB':'#B7C8B9'}]}>
          <MaterialCommunityIcons name={disturbed?'magnet':'crosshairs-gps'} size={18}
            color={disturbed?'#E8A16B':compassAccuracy===3?SUCCESS:colors.gold}/>
          <Text style={{fontSize:10,fontWeight:'800',color:colors.text}}>
            {errorDegrees!==null?'±'+errorDegrees+'°'
              :compassAccuracy===null?'—':compassAccuracy===3?'İyi':compassAccuracy===2?'Orta':'Düşük'}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable onPress={primaryAction} disabled={busy} accessibilityRole="button"
          accessibilityLabel={!locationReady?'Konumu etkinleştir':'Yeniden kalibrasyon rehberini aç'}
          style={({pressed})=>[styles.primaryButton,{opacity:busy?.7:pressed?.88:1,flex:1.18}]}>
          <GoldButtonBackground/>
          {busy?<ActivityIndicator color={ON_GOLD} size="small"/>:
            <MaterialCommunityIcons name={locationReady?'refresh':'crosshairs-gps'} size={22} color={ON_GOLD}/>}
          <Text adjustsFontSizeToFit numberOfLines={1}
            style={{color:ON_GOLD,fontSize:14,fontWeight:'800'}}>
            {locationReady?'Yeniden Kalibre Et':'Konumu Etkinleştir'}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={()=>void openMap()}
          style={({pressed})=>[styles.secondaryButton,{
            flex:.93,backgroundColor:dark?'rgba(10,47,74,.9)':'rgba(253,250,238,.89)',
            borderColor:colors.gold,opacity:pressed?.78:1,
          }]}>
          <Feather name="map" size={20} color={colors.gold}/>
          <Text numberOfLines={1} adjustsFontSizeToFit
            style={{fontSize:14,color:colors.text,fontFamily:'serif',fontWeight:'700'}}>
            Haritada Gör
          </Text>
        </Pressable>
      </View>
      {needsCalibration?<View style={[styles.calibration,{
        borderColor:disturbed?'#E8A16B':colors.gold,
        backgroundColor:dark?'rgba(10,49,75,.72)':'rgba(255,251,239,.78)',
      }]}>
        <QiblaCalibrationGuide width={Math.min(260,width-80)} color={colors.gold}/>
        <Text style={{color:colors.text,fontSize:12,lineHeight:19,textAlign:'center',fontWeight:'600'}}>
          {disturbed
            ?'Mıknatıs ve metallerden uzaklaş, sonra telefonu havada yavaşça 8 çiz.'
            :'Telefonu havada yavaşça 8 şeklinde 2–3 kez hareket ettir, sonra yere paralel tut.'}
        </Text>
      </View>:<View style={[styles.helper,{borderColor:'transparent'}]}>
        <MaterialCommunityIcons name="cellphone-arrow-down" size={26} color={colors.gold}/>
        <View style={{height:34,width:1,backgroundColor:colors.gold,opacity:.54}}/>
        <Text style={{color:colors.text,fontSize:11.5,lineHeight:19,flex:1}}>
          Telefonu yere paralel tut ve üst kenarını altın ibrenin gösterdiği yöne çevir.
        </Text>
      </View>}
      {permissionDenied?<Pressable onPress={()=>Linking.openSettings().catch(()=>undefined)}
        style={{alignSelf:'center',paddingVertical:6}} accessibilityRole="button">
        <Text style={{fontSize:12,color:colors.gold,fontWeight:'700'}}>
          Konum izinlerini ayarlarda aç
        </Text>
      </Pressable>:null}
      {locationReady&&(!hasValidHeading||compassAccuracy===1||disturbed)
        ?<Text style={{fontSize:11,lineHeight:17,color:colors.muted,textAlign:'center',
          paddingHorizontal:13,marginTop:0}}>
          {detailMessage}
        </Text>:null}
      {locationAccuracy!==null&&locationAccuracy>200
        ?<Text style={{fontSize:10,color:colors.muted,textAlign:'center'}}>
          Konum hassasiyeti düşük (~{Math.round(locationAccuracy)} m). Açık alanda yeniden dene.
        </Text>:null}
    </ScrollView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  content:{paddingTop:12,paddingBottom:31,alignItems:'center',gap:10},
  brand:{height:33,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10},
  headline:{alignItems:'center',gap:3},
  eyebrow:{flexDirection:'row',alignItems:'center',gap:12},
  rule:{height:1,width:35,opacity:.78},
  status:{borderWidth:1.3,borderRadius:26,paddingHorizontal:21,
    minHeight:44,flexDirection:'row',alignItems:'center',gap:11,
    shadowOffset:{width:0,height:1},elevation:3},
  anglePlaque:{maxWidth:370,width:'94%',minHeight:77,borderWidth:1.4,borderRadius:23,
    alignSelf:'center',alignItems:'center',justifyContent:'center',
    gap:5,paddingHorizontal:11,paddingVertical:10},
  guidanceRow:{flexDirection:'row',alignItems:'center',justifyContent:'center',
    width:'100%',gap:10},
  azimuthRow:{flexDirection:'row',alignItems:'center',
    justifyContent:'center',gap:11,width:'100%'},
  goldDiamond:{height:7,width:7,transform:[{rotate:'45deg'}],opacity:.8,marginHorizontal:2},
  locationCard:{marginTop:4,width:'100%',minHeight:81,borderRadius:19,borderWidth:1,
    flexDirection:'row',alignItems:'center',paddingHorizontal:16,paddingVertical:11,gap:11},
  sensorBadge:{minWidth:57,height:30,paddingHorizontal:8,
    borderWidth:1,borderRadius:18,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5},
  actions:{width:'100%',flexDirection:'row',gap:11,marginTop:3},
  primaryButton:{height:54,borderRadius:16,borderWidth:1.4,borderColor:'#F6D88D',overflow:'hidden',
    flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
  secondaryButton:{height:54,borderRadius:16,borderWidth:1.4,
    flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9},
  helper:{width:'100%',padding:7,borderRadius:12,borderWidth:1,
    flexDirection:'row',gap:13,alignItems:'center',marginTop:2},
  calibration:{width:'100%',borderRadius:18,borderWidth:1.2,paddingVertical:12,
    paddingHorizontal:14,alignItems:'center',gap:8,marginTop:2},
});
