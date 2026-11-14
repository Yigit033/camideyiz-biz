import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {
  ActivityIndicator,Alert,Linking,Pressable,ScrollView,StyleSheet,
  Text,View,useWindowDimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from 'expo-router';
import {Feather,MaterialCommunityIcons} from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import Svg,{Defs,LinearGradient,Rect,Stop} from 'react-native-svg';
import {qiblaBearing,relativeQiblaAngle,qiblaGuidance} from '@camideyiz/core';
import {useAppTheme} from '@/theme/ThemeProvider';
import {QiblaBackdrop,QiblaCompass,QiblaKaabaGlyph} from '@/features/qibla/QiblaArtwork';

const KAABA_MAP_URL='https://www.google.com/maps/search/?api=1&query=21.4225%2C39.8262';
const GOLD='#EDCE8A';
type CompassAccuracy=0|1|2|3;

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
  const [bearing,setBearing]=useState<number|null>(null);
  const [heading,setHeading]=useState<number|null>(null);
  const [compassAccuracy,setCompassAccuracy]=useState<CompassAccuracy|null>(null);
  const [locationAccuracy,setLocationAccuracy]=useState<number|null>(null);
  const [locationLabel,setLocationLabel]=useState('Konum bekleniyor');
  const [headingEnabled,setHeadingEnabled]=useState(false);
  const [permissionDenied,setPermissionDenied]=useState(false);
  const [busy,setBusy]=useState(false);
  const [cycle,setCycle]=useState(0);
  const [showGuide,setShowGuide]=useState(false);
  const [message,setMessage]=useState('Konumuna izin vererek kıble yönünü bulabilirsin.');
  const mounted=useRef(true);
  const pending=useRef(false);
  const headingSample=useRef<{angle:number;time:number}|null>(null);
  const lastAlignedHaptic=useRef(0);
  const compassSize=Math.min(Math.max(255,width-42),352);
  const locationReady=bearing!==null;
  const relative=locationReady&&heading!==null?relativeQiblaAngle(bearing,heading):null;
  // Low calibration does not yield actionable turn directions.
  const hasValidHeading=relative!==null&&compassAccuracy!==null&&compassAccuracy>=2;
  const guidance=useMemo(()=>hasValidHeading&&bearing!==null&&heading!==null
    ?qiblaGuidance(bearing,heading):null,[hasValidHeading,bearing,heading]);
  const aligned=guidance?.direction==='near'&&compassAccuracy===3;

  const locate=useCallback(async(requestPermission:boolean)=>{
    if(pending.current)return;
    pending.current=true;
    if(mounted.current)setBusy(true);
    try{
      const permission=requestPermission
        ?await Location.requestForegroundPermissionsAsync()
        :await Location.getForegroundPermissionsAsync();
      if(!permission.granted){
        if(requestPermission&&mounted.current){
          setPermissionDenied(true);
          setMessage('Konum izni olmadan güvenilir kıble yönü hesaplanamaz.');
        }
        return;
      }
      if(mounted.current)setPermissionDenied(false);
      const position=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.High});
      if(!mounted.current)return;
      const nextBearing=qiblaBearing(position.coords.latitude,position.coords.longitude);
      setBearing(nextBearing);
      setLocationAccuracy(position.coords.accuracy??null);
      setHeadingEnabled(true);
      setMessage('Telefonu düz tutup yavaşça çevir. Metal ve mıknatıslardan uzak dur.');
      try{
        const addresses=await Location.reverseGeocodeAsync({
          latitude:position.coords.latitude,
          longitude:position.coords.longitude,
        });
        if(!mounted.current)return;
        const a=addresses[0];
        const city=a?.city??a?.region??a?.subregion??null;
        const country=a?.country??null;
        setLocationLabel(city?[city,country].filter(Boolean).join(', '):'Konum alındı');
      }catch{
        if(mounted.current)setLocationLabel('Konum alındı');
      }
    }catch{
      if(mounted.current)setMessage('Konum belirlenemedi. Konum servislerini kontrol edip yeniden dene.');
    }finally{
      pending.current=false;
      if(mounted.current)setBusy(false);
    }
  },[]);

  useEffect(()=>{
    mounted.current=true;
    Location.getForegroundPermissionsAsync().then(permission=>{
      if(mounted.current&&permission.granted)void locate(false);
    }).catch(()=>undefined);
    return ()=>{mounted.current=false;};
  },[locate]);

  useFocusEffect(useCallback(()=>{
    if(!headingEnabled)return;
    let active=true;
    let subscription:Location.LocationSubscription|null=null;
    headingSample.current=null;
    Location.watchHeadingAsync(reading=>{
      if(!active||!Number.isFinite(reading.trueHeading)||reading.trueHeading<0){
        if(active){setHeading(null);setCompassAccuracy(null);}
        return;
      }
      const accuracy=Math.max(0,Math.min(3,Math.trunc(reading.accuracy))) as CompassAccuracy;
      setCompassAccuracy(old=>old===accuracy?old:accuracy);
      if(accuracy===0){setHeading(null);return;}
      const now=Date.now();
      const previous=headingSample.current;
      const delta=previous?Math.abs(((reading.trueHeading-previous.angle+540)%360)-180):360;
      if(previous&&now-previous.time<90&&delta<.7)return;
      headingSample.current={angle:reading.trueHeading,time:now};
      setHeading(reading.trueHeading);
    },()=>{
      if(active){
        setHeading(null);setCompassAccuracy(null);
        setMessage('Pusula sensörü kullanılamıyor. Cihazını kalibre etmeyi dene.');
      }
    }).then(next=>{
      if(active)subscription=next;
      else next.remove();
    }).catch(()=>{
      if(active){
        setHeading(null);setCompassAccuracy(null);
        setMessage('Bu cihazda pusula sensörüne erişilemiyor.');
      }
    });
    return ()=>{active=false;subscription?.remove();};
  },[headingEnabled,cycle]));

  useEffect(()=>{
    if(!aligned||Date.now()-lastAlignedHaptic.current<12000)return;
    lastAlignedHaptic.current=Date.now();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>undefined);
  },[aligned]);

  const primaryAction=()=>{
    if(!locationReady){void locate(true);return;}
    setShowGuide(true);
    setHeading(null);
    setCompassAccuracy(null);
    setCycle(old=>old+1);
    setMessage('Kalibrasyon için telefonu havada yatay bir 8 hareketiyle yavaşça döndür.');
    Haptics.selectionAsync().catch(()=>undefined);
  };
  const openMap=async()=>{
    try{await Linking.openURL(KAABA_MAP_URL);}
    catch{Alert.alert('Harita açılamadı','Kâbe konumunu açmak için tarayıcı ayarlarını kontrol et.');}
  };
  // Relative live turn guidance is the primary instruction. Absolute bearing is
  // shown only as a labelled reference, never presented as a turn instruction.
  const turnInstruction=!locationReady?'Konum bekleniyor'
    :compassAccuracy===1?'Önce pusulayı kalibre et'
    :!guidance?'Pusula yönü bekleniyor'
    :guidance.direction==='near'
      ?compassAccuracy===3?'Kıble doğrultusuna yakınsın':'Doğrultuya yakın · kalibre et'
      :guidance.direction==='right'?'Sağa '+guidance.turnDegrees+'° dön'
      :'Sola '+guidance.turnDegrees+'° dön';
  const absoluteBearingText=bearing===null
    ?'Kâbe açısı konum alındığında hesaplanır'
    :'Kâbe açısı '+Math.round(bearing)+'° · Gerçek kuzeye göre';
  const headingStatus=!locationReady?'Konumunu etkinleştir'
    :compassAccuracy===1?'Kalibrasyon gerekli'
    :!hasValidHeading?'Pusula sinyali bekleniyor'
    :aligned?'Kıble doğrultusuna yakınsın'
    :guidance?.direction==='near'?'Sensör doğruluğunu artır'
    :'İbreyi takip ederek yönel';
  const detailMessage=compassAccuracy===1
    ?'Pusula sinyali düşük. Metal eşyalardan uzaklaş ve cihazı kalibre et.'
    :message;
  return <SafeAreaView edges={['top']} style={{flex:1,backgroundColor:dark?'#002B25':colors.canvas}}>
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
          fontWeight:'700',color:colors.text,textShadowColor:dark?'#052822':'transparent',
          textShadowRadius:8}}>
          Kıble
        </Text>
      </View>
      <View style={{marginTop:4,marginBottom:0}}>
        <QiblaCompass size={compassSize}
          relative={hasValidHeading?relative:null}
          heading={hasValidHeading?heading:null}
          available={hasValidHeading} aligned={aligned}/>
      </View>

      <View style={[styles.status,{
        backgroundColor:dark?'rgba(8,54,44,.91)':'rgba(255,253,243,.93)',
        borderColor:hasValidHeading?GOLD:colors.border,
        shadowColor:hasValidHeading?'#DAB56A':'transparent',
        shadowOpacity:hasValidHeading?.27:0,shadowRadius:13,
      }]}>
        <Feather name={aligned?'check-circle':locationReady?'compass':'map-pin'}
          size={20} color={aligned?'#9CE6A9':colors.gold}/>
        <Text style={{color:colors.text,fontFamily:'serif',fontSize:17,
          fontWeight:'700'}}>{headingStatus}</Text>
      </View>
      <View style={[styles.anglePlaque,{
        borderColor:colors.gold,
        backgroundColor:dark?'rgba(5,55,43,.85)':'rgba(255,252,240,.89)',
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
        backgroundColor:dark?'rgba(8,63,52,.9)':'rgba(255,254,247,.9)',
        borderColor:dark?'#407E67':colors.border,
      }]}>
        <MaterialCommunityIcons name="map-marker" size={30} color={GOLD}/>
        <View style={{flex:1,gap:5,minWidth:0}}>
          <Text numberOfLines={1} style={{color:colors.text,fontFamily:'serif',fontSize:19,fontWeight:'700'}}>
            {locationLabel}
          </Text>
          <Text numberOfLines={2} style={{color:colors.muted,fontSize:11,lineHeight:17}}>
            {locationReady?'Konum alındı':'Konum izni bekleniyor'}
            {'  ·  Pusula: '+statusName(compassAccuracy)}
          </Text>
        </View>
        <View style={[styles.sensorBadge,{borderColor:colors.isDark?'#388A70':'#B7C8B9'}]}>
          <MaterialCommunityIcons name="crosshairs-gps" size={18}
            color={compassAccuracy===3?'#9EEDB9':colors.gold}/>
          <Text style={{fontSize:10,fontWeight:'800',color:colors.text}}>
            {compassAccuracy===null?'—':compassAccuracy===3?'İyi':compassAccuracy===2?'Orta':'Düşük'}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable onPress={primaryAction} disabled={busy} accessibilityRole="button"
          accessibilityLabel={!locationReady?'Konumu etkinleştir':'Yeniden kalibrasyon rehberini aç'}
          style={({pressed})=>[styles.primaryButton,{opacity:busy?.7:pressed?.88:1,flex:1.18}]}>
          <GoldButtonBackground/>
          {busy?<ActivityIndicator color="#11392D" size="small"/>:
            <MaterialCommunityIcons name={locationReady?'refresh':'crosshairs-gps'} size={22} color="#10372B"/>}
          <Text adjustsFontSizeToFit numberOfLines={1}
            style={{color:'#16382B',fontSize:14,fontWeight:'800'}}>
            {locationReady?'Yeniden Kalibre Et':'Konumu Etkinleştir'}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={()=>void openMap()}
          style={({pressed})=>[styles.secondaryButton,{
            flex:.93,backgroundColor:dark?'rgba(4,53,43,.85)':'rgba(253,250,238,.89)',
            borderColor:colors.gold,opacity:pressed?.78:1,
          }]}>
          <Feather name="map" size={20} color={colors.gold}/>
          <Text numberOfLines={1} adjustsFontSizeToFit
            style={{fontSize:14,color:colors.text,fontFamily:'serif',fontWeight:'700'}}>
            Haritada Gör
          </Text>
        </Pressable>
      </View>
      <View style={[styles.helper,{
        borderColor:showGuide?colors.gold:'transparent',
        backgroundColor:showGuide?(dark?'rgba(10,55,48,.6)':'rgba(255,251,239,.65)'):'transparent',
      }]}>
        <MaterialCommunityIcons name="infinity" size={30} color={colors.gold}/>
        <View style={{height:34,width:1,backgroundColor:colors.gold,opacity:.54}}/>
        <Text style={{color:colors.text,fontSize:11.5,lineHeight:19,flex:1}}>
          {showGuide?'Telefonu metal eşyalardan uzak tut. Kalibrasyon için havada yavaşça 8 hareketi yap.':
            'Daha doğru sonuç için telefonu düz tut; gerekiyorsa havada yavaşça 8 hareketi yap.'}
        </Text>
      </View>
      {permissionDenied?<Pressable onPress={()=>Linking.openSettings().catch(()=>undefined)}
        style={{alignSelf:'center',paddingVertical:6}} accessibilityRole="button">
        <Text style={{fontSize:12,color:colors.gold,fontWeight:'700'}}>
          Konum izinlerini ayarlarda aç
        </Text>
      </Pressable>:null}
      {locationReady&&(!hasValidHeading||compassAccuracy===1)
        ?<Text style={{fontSize:11,lineHeight:17,color:colors.muted,textAlign:'center',
          paddingHorizontal:13,marginTop:0}}>
          {detailMessage}
        </Text>:null}
      {locationAccuracy!==null&&locationAccuracy>200
        ?<Text style={{fontSize:10,color:colors.muted,textAlign:'center'}}>
          Konum hassasiyeti düşük (~{Math.round(locationAccuracy)} m). Açık alanda yeniden dene.
        </Text>:null}
      <Text style={{fontSize:10,lineHeight:17,color:colors.muted,textAlign:'center',marginTop:3}}>
        Telefonun üst kenarını ibrenin gösterdiği yöne çevir. Pusula manyetik alanlardan etkilenebilir;
        derece göstergesi sensörün kesin doğruluğunu garanti etmez.
      </Text>
    </ScrollView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  content:{paddingTop:14,paddingBottom:31,alignItems:'center',gap:12},
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
});
