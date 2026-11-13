import {useState} from 'react';
import {ActivityIndicator,Alert,Linking,Pressable,StyleSheet,Text,View} from 'react-native';
import * as Location from 'expo-location';
import {Feather,MaterialCommunityIcons} from '@expo/vector-icons';
import {Page,Panel} from '@/components/Page';
import {useAppTheme} from '@/theme/ThemeProvider';
import {MosqueCrest,ArabesqueCorner} from '@/components/LuxuryArtwork';

export default function NearbyMosques(){
  const {colors}=useAppTheme();
  const [loading,setLoading]=useState(false);
  const navigate=async(query:string)=>{
    try{await Linking.openURL('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query));}
    catch{Alert.alert('Harita açılamadı','Tarayıcını veya harita uygulamanı kontrol et.');}
  };
  const nearby=async()=>{
    setLoading(true);
    try{
      const permission=await Location.requestForegroundPermissionsAsync();
      if(permission.status!=='granted'){
        Alert.alert('Konum izni gerekli','Yakın camileri haritada bulmak için konum izni gerekiyor. İstersen şehir bazlı aramayı kullan.');
        return;
      }
      const position=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
      const {latitude,longitude}=position.coords;
      await navigate('cami near '+latitude.toFixed(5)+','+longitude.toFixed(5));
    }catch{
      Alert.alert('Konum belirlenemedi','Konum servislerini kontrol et veya şehir bazlı aramayı kullan.');
    }finally{setLoading(false);}
  };
  return <Page title="Yakın Camiler" subtitle="Çevrendeki camileri haritada keşfet.">
    <View style={[styles.hero,{backgroundColor:colors.surface,borderColor:colors.border}]}>
      <ArabesqueCorner dark={colors.isDark} width={120}/>
      <View style={{alignItems:'center',paddingVertical:8}}>
        <MosqueCrest width={220} dark={colors.isDark}/>
        <Text style={{fontFamily:'serif',fontSize:23,fontWeight:'700',color:colors.text,marginTop:7}}>Yolunu Bul</Text>
        <Text style={{fontSize:12,lineHeight:19,color:colors.muted,textAlign:'center',marginTop:7}}>
          Konumuna en yakın camileri Google Haritalar'da göster.
        </Text>
      </View>
      <Pressable accessibilityRole="button" disabled={loading} onPress={nearby}
        style={[styles.primary,{backgroundColor:colors.isDark?'#42BD95':'#08775B'}]}>
        {loading?<ActivityIndicator size="small" color="#FFF"/>:<MaterialCommunityIcons name="crosshairs-gps" size={20} color="#FFF"/>}
        <Text style={{color:'#FFF',fontWeight:'700',fontSize:14}}>Konumumun yakınında ara</Text>
      </Pressable>
    </View>
    <Panel>
      <View style={{flexDirection:'row',alignItems:'center',gap:9}}>
        <Feather name="map-pin" color={colors.gold} size={18}/>
        <Text style={{fontSize:16,fontWeight:'700',color:colors.text}}>Şehir bazlı arama</Text>
      </View>
      <Text style={{color:colors.muted,fontSize:12,lineHeight:20}}>
        Konum izni vermeden İstanbul'daki camileri görüntüleyebilirsin.
      </Text>
      <Pressable accessibilityRole="button" onPress={()=>navigate('İstanbul camiler')}
        style={[styles.secondary,{borderColor:colors.border,backgroundColor:colors.soft}]}>
        <Feather name="map" size={16} color={colors.emerald}/>
        <Text style={{color:colors.text,fontWeight:'700'}}>İstanbul camilerini göster</Text>
        <Feather name="arrow-up-right" size={15} color={colors.muted}/>
      </Pressable>
    </Panel>
    <Text style={{color:colors.muted,fontSize:11,lineHeight:18}}>
      Harita sonuçları Google Haritalar tarafından sağlanır. Uygulama konumunu kendi sunucusuna kaydetmez.
    </Text>
  </Page>;
}
const styles=StyleSheet.create({
  hero:{borderWidth:1,borderRadius:25,padding:20,overflow:'hidden',gap:12},
  primary:{height:49,borderRadius:15,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:10},
  secondary:{minHeight:48,borderRadius:13,borderWidth:1,flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:12,gap:8},
});
