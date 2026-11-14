import {useEffect,useState} from 'react';
import {ActivityIndicator,Pressable,Text,View} from 'react-native';
import {Feather,MaterialCommunityIcons} from '@expo/vector-icons';
import * as Location from 'expo-location';
import {qiblaBearing,relativeQiblaAngle} from '@camideyiz/core';
import {Page,Panel} from '@/components/Page';
import {useAppTheme} from '@/theme/ThemeProvider';
export default function QiblaScreen(){
  const {colors}=useAppTheme();
  const [bearing,setBearing]=useState<number|null>(null);
  const [trueHeading,setTrueHeading]=useState<number|null>(null);
  const [loading,setLoading]=useState(false);
  const [headingEnabled,setHeadingEnabled]=useState(false);
  const [message,setMessage]=useState('Konum izni verdiğinde Kâbe yönünü hesaplayabiliriz.');
  useEffect(()=>{
    let active=true;
    let sub:Location.LocationSubscription|null=null;
    const startHeading=async()=>{
      try{
        sub=await Location.watchHeadingAsync(h=>{
          if(!active)return;
          if(h.trueHeading>=0)setTrueHeading(h.trueHeading);
          else{setTrueHeading(null);setMessage('Gerçek kuzey verisi yok. Pusula yönünü güvenilir biçimde gösteremiyoruz.');}
        });
        if(!active)sub.remove();
      }catch{if(active)setMessage('Pusula sensörü kullanılamıyor veya kalibre edilmeli.');}
    };
    if(headingEnabled)startHeading();
    return ()=>{active=false;sub?.remove();};
  },[headingEnabled]);
  const locate=async()=>{
    setLoading(true);
    try{
      const permission=await Location.requestForegroundPermissionsAsync();
      if(permission.status!=='granted'){setMessage('Konum izni verilmedi.');return;}
      setHeadingEnabled(true);
      const position=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
      setBearing(qiblaBearing(position.coords.latitude,position.coords.longitude));
      setMessage('Cihazı yatay tutun. Manyetik alanlar pusula doğruluğunu etkileyebilir.');
    }catch{setMessage('Konum alınamadı. GPS ve konum izinlerini kontrol edin.');}
    finally{setLoading(false);}
  };
  const relative=bearing!==null&&trueHeading!==null?relativeQiblaAngle(bearing,trueHeading):null;
  return <Page title="Kıble" subtitle="Gerçek kuzey ve konum verisini kullanarak Kâbe yönünü bul.">
    <Panel>
      <View style={{height:235,alignItems:'center',justifyContent:'center',gap:12}}>
        <View style={{width:194,height:194,borderRadius:97,borderWidth:2,borderColor:colors.gold,alignItems:'center',justifyContent:'center',backgroundColor:colors.soft}}>
          <Text style={{color:colors.muted,fontSize:13,position:'absolute',top:10,fontWeight:'700'}}>K</Text>
          {relative!==null?<View style={{transform:[{rotate:String(relative)+'deg'}]}}><Feather name="navigation" size={84} color={colors.emerald}/></View>:<Feather name="compass" size={84} color={colors.muted}/>}
        </View>
      </View>
      <Text style={{color:colors.text,textAlign:'center',fontSize:22,fontWeight:'700'}}>{relative!==null?Math.round(relative)+'° sağa dön':'Yön doğrulanmadı'}</Text>
      <Text style={{color:colors.muted,textAlign:'center',fontSize:13,lineHeight:21}}>{message}</Text>
      <Pressable accessibilityRole="button" disabled={loading} onPress={locate} style={{backgroundColor:colors.emerald,borderRadius:14,padding:15,flexDirection:'row',justifyContent:'center',gap:8}}>
        {loading?<ActivityIndicator color="#FFFFFF"/>:<MaterialCommunityIcons name="crosshairs-gps" size={20} color={colors.isDark?'#102722':'#FFFFFF'}/>}
        <Text style={{color:colors.isDark?'#102722':'#FFFFFF',fontWeight:'800'}}>Konumumu kullan</Text>
      </Pressable>
    </Panel>
    <Text style={{color:colors.muted,fontSize:12,lineHeight:20}}>Telefon pusulası manyetik etkileşimlerden etkilenir. Gerçek kuzey verisi olmayan cihazlarda yön gösterilmez.</Text>
  </Page>;
}
