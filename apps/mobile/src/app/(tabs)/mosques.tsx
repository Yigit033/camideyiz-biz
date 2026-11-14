import {useCallback,useState} from 'react';
import {
  ActivityIndicator,Alert,Keyboard,Linking,Pressable,ScrollView,
  StyleSheet,Text,TextInput,View,useWindowDimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Feather,MaterialCommunityIcons} from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {googleMosqueSearchURL} from '@camideyiz/core';
import {Atmosphere,MosqueCrest,MosqueLandscape} from '@/components/LuxuryArtwork';
import {useAppTheme} from '@/theme/ThemeProvider';

const SUGGESTIONS=['İstanbul','Ankara','İzmir','Konya'];
type InfoIcon='map-pin'|'navigation'|'image';
function InfoRow({icon,title,description}:{
  icon:InfoIcon;title:string;description:string;
}){
  const {colors}=useAppTheme();
  return <View style={styles.infoRow}>
    <View style={[styles.infoIcon,{backgroundColor:colors.soft,borderColor:colors.border}]}>
      <Feather name={icon} color={colors.gold} size={17}/>
    </View>
    <View style={{flex:1,gap:3}}>
      <Text style={{fontSize:13,fontWeight:'700',color:colors.text}}>{title}</Text>
      <Text style={{fontSize:11,lineHeight:18,color:colors.muted}}>{description}</Text>
    </View>
  </View>;
}

export default function MosquesScreen(){
  const {colors}=useAppTheme();
  const {width}=useWindowDimensions();
  const [area,setArea]=useState('');
  const [opening,setOpening]=useState(false);
  const landscapeWidth=Math.min(330,Math.max(205,width-86));
  const openMaps=useCallback(async(selectedArea?:string)=>{
    if(opening)return;
    Keyboard.dismiss();
    setOpening(true);
    try{
      const url=googleMosqueSearchURL(selectedArea??area);
      // Maps URLs are universal: native Google Maps when installed,
      // otherwise the device browser. No Google Places or Maps SDK.
      await Linking.openURL(url);
      Haptics.selectionAsync().catch(()=>undefined);
    }catch{
      Alert.alert('Google Haritalar açılamadı',
        'Bağlantınızı ve cihazınızın tarayıcı ayarlarını kontrol edip tekrar deneyin.');
    }finally{
      setOpening(false);
    }
  },[opening,area]);

  return <SafeAreaView edges={['top']} style={{flex:1,backgroundColor:colors.canvas}}>
    <Atmosphere dark={colors.isDark}/>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}>
      <View style={styles.heading}>
        <Text style={{color:colors.gold,fontSize:10,letterSpacing:2.3,fontWeight:'800'}}>
          CAMİDEYİZ BİZ · KEŞFET
        </Text>
        <Text style={{fontFamily:'serif',color:colors.text,fontSize:32,
          fontWeight:'700',letterSpacing:-.7}}>Camiler</Text>
        <Text style={{color:colors.muted,fontSize:13,lineHeight:21}}>
          Yakınındaki camileri keşfet, ziyaretini planla ve yolunu kolayca bul.
        </Text>
      </View>

      <View style={[styles.hero,{
        backgroundColor:colors.isDark?'#123B35':'#E8F0E7',
        borderColor:colors.isDark?'#467F6F':'#C8D9CA',
      }]}>
        <View pointerEvents="none" style={[styles.halo,{
          backgroundColor:colors.isDark?'rgba(95,177,145,.10)':'rgba(255,255,255,.62)',
        }]}/>
        <View style={styles.illustration}>
          <MosqueLandscape width={landscapeWidth} dark={colors.isDark}/>
          <View style={[styles.crest,{
            backgroundColor:colors.isDark?'rgba(11,46,40,.7)':'rgba(255,255,255,.78)',
            borderColor:colors.isDark?'#447F6C':'#C7D4C4',
          }]}>
            <MosqueCrest width={64} dark={colors.isDark}/>
          </View>
        </View>
        <Text style={[styles.heroTitle,{color:colors.text}]}>Bir cami, bir huzur durağı.</Text>
        <Text style={[styles.heroDescription,{color:colors.muted}]}>
          Google Haritalar'da çevrendeki camileri, fotoğraflarını ve yol tariflerini görüntüle.
        </Text>
        <Pressable accessibilityRole="button"
          accessibilityLabel="Google Haritalar'da cami ara"
          accessibilityHint={area.trim()?area.trim()+' çevresindeki camileri Google Haritalar’da açar':
            'Yakınındaki camileri Google Haritalar uygulamasında veya tarayıcıda açar'}
          onPress={()=>openMaps()}
          disabled={opening}
          style={({pressed})=>[styles.primary,{
            backgroundColor:colors.isDark?'#128868':'#087456',
            opacity:opening?.72:pressed?.88:1,
          }]}>
          {opening?<ActivityIndicator color="#FFF" size="small"/>:
            <MaterialCommunityIcons name="google-maps" size={22} color="#FFF4D8"/>}
          <Text style={styles.primaryText}>{opening?'Haritalar açılıyor…':'Haritada Ara'}</Text>
          <Feather name="arrow-up-right" size={18} color="#FFF4D8"/>
        </Pressable>
        <View style={styles.heroFoot}>
          <Feather name="external-link" size={13} color={colors.muted}/>
          <Text style={{fontSize:11,color:colors.muted}}>
            Google Haritalar'da açılır · Uygulama içi API ücreti yok
          </Text>
        </View>
      </View>

      <View style={[styles.searchCard,{backgroundColor:colors.surface,borderColor:colors.border}]}>
        <View style={styles.searchCardHeading}>
          <View style={[styles.searchGlyph,{backgroundColor:colors.soft}]}>
            <Feather name="map-pin" color={colors.emerald} size={19}/>
          </View>
          <View style={{flex:1,gap:3}}>
            <Text style={{fontFamily:'serif',fontSize:18,fontWeight:'700',color:colors.text}}>
              Başka bir bölgede ara
            </Text>
            <Text style={{color:colors.muted,fontSize:11,lineHeight:18}}>
              İl, ilçe veya semt adı yaz; harita aramasını o bölgede açalım.
            </Text>
          </View>
        </View>
        <View style={[styles.inputFrame,{borderColor:colors.border,backgroundColor:colors.soft}]}>
          <Feather name="search" size={17} color={colors.gold}/>
          <TextInput
            accessibilityLabel="Cami aranacak bölge"
            placeholder="Örn. Üsküdar, İstanbul"
            placeholderTextColor={colors.muted}
            value={area} onChangeText={setArea}
            maxLength={80} autoCorrect={false} autoCapitalize="words"
            returnKeyType="search" onSubmitEditing={()=>openMaps()}
            style={{flex:1,fontSize:13,color:colors.text,paddingVertical:9}}
            selectionColor={colors.emerald}/>
          {area.length>0?<Pressable accessibilityRole="button" accessibilityLabel="Bölgeyi temizle"
            onPress={()=>setArea('')} hitSlop={10}>
            <Feather name="x-circle" size={17} color={colors.muted}/>
          </Pressable>:null}
        </View>
        <ScrollView horizontal keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false} style={{flexGrow:0}}
          contentContainerStyle={{gap:8,paddingVertical:1}}>
          {SUGGESTIONS.map(city=><Pressable key={city}
            accessibilityRole="button"
            accessibilityState={{selected:area===city}}
            onPress={()=>setArea(city)}
            style={[styles.chip,{
              backgroundColor:area===city?colors.soft:colors.canvas,
              borderColor:area===city?colors.gold:colors.border,
            }]}>
            <Text style={{color:colors.text,fontSize:11,fontWeight:'700'}}>{city}</Text>
          </Pressable>)}
        </ScrollView>
        <View style={[styles.tip,{borderTopColor:colors.border}]}>
          <Feather name="info" size={14} color={colors.gold}/>
          <Text style={{fontSize:11,lineHeight:18,color:colors.muted,flex:1}}>
            Bölge boş bırakılırsa Google Haritalar, cihazının konumuna göre yakın sonuçlar göstermeye çalışır.
          </Text>
        </View>
      </View>

      <View style={[styles.features,{backgroundColor:colors.surface,borderColor:colors.border}]}>
        <Text style={{fontFamily:'serif',fontWeight:'700',fontSize:18,color:colors.text,marginBottom:2}}>
          Haritada neler bulabilirsin?
        </Text>
        <InfoRow icon="map-pin" title="Yakındaki camiler"
          description="Cami isimleri ve harita üzerindeki konumlar."/>
        <InfoRow icon="image" title="Fotoğraflar ve bilgiler"
          description="Google Haritalar'daki mevcut fotoğraflar, yorumlar ve adresler."/>
        <InfoRow icon="navigation" title="Yol tarifi"
          description="Yaya, araç veya toplu taşıma seçenekleri Google Haritalar'da."/>
      </View>
      <View style={styles.disclaimer}>
        <Feather name="shield" size={14} color={colors.gold}/>
        <Text style={{flex:1,color:colors.muted,fontSize:10,lineHeight:17}}>
          Camideyiz Biz cami verilerini toplamaz veya konumunu bu sayfada kendi sunucusuna göndermez.
          Haritalar açıldıktan sonraki arama ve konum işlemlerini Google yönetir.
        </Text>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles=StyleSheet.create({
  content:{paddingHorizontal:18,paddingTop:23,paddingBottom:40,gap:17},
  heading:{gap:8,paddingHorizontal:3,marginBottom:3},
  hero:{borderWidth:1,borderRadius:27,paddingHorizontal:19,paddingVertical:21,
    overflow:'hidden',alignItems:'center',gap:11},
  halo:{position:'absolute',width:330,height:330,borderRadius:165,top:-145,right:-140},
  illustration:{height:184,width:'100%',alignItems:'center',justifyContent:'flex-end',
    paddingBottom:10},
  crest:{position:'absolute',top:0,right:1,width:63,height:63,borderRadius:21,
    borderWidth:1,alignItems:'center',justifyContent:'center'},
  heroTitle:{fontFamily:'serif',fontSize:22,fontWeight:'700',textAlign:'center',letterSpacing:-.3},
  heroDescription:{textAlign:'center',fontSize:12,lineHeight:20,maxWidth:310,marginBottom:8},
  primary:{height:55,borderRadius:17,width:'100%',
    flexDirection:'row',alignItems:'center',justifyContent:'center',gap:12,
    shadowColor:'#082A1E',shadowOpacity:.18,shadowRadius:8,elevation:3},
  primaryText:{color:'#FFFFFF',fontSize:15,fontWeight:'800',letterSpacing:.2},
  heroFoot:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,flexWrap:'wrap'},
  searchCard:{borderWidth:1,borderRadius:23,padding:17,gap:14},
  searchCardHeading:{flexDirection:'row',alignItems:'center',gap:11},
  searchGlyph:{width:43,height:43,borderRadius:14,alignItems:'center',justifyContent:'center'},
  inputFrame:{borderWidth:1,borderRadius:14,minHeight:46,
    paddingHorizontal:12,flexDirection:'row',gap:9,alignItems:'center'},
  chip:{borderWidth:1,borderRadius:15,paddingHorizontal:14,paddingVertical:9},
  tip:{borderTopWidth:1,paddingTop:12,flexDirection:'row',alignItems:'flex-start',gap:8},
  features:{borderWidth:1,borderRadius:23,padding:17,gap:15},
  infoRow:{flexDirection:'row',alignItems:'center',gap:13},
  infoIcon:{height:43,width:43,borderRadius:14,borderWidth:1,
    alignItems:'center',justifyContent:'center'},
  disclaimer:{flexDirection:'row',alignItems:'flex-start',gap:9,paddingHorizontal:4,paddingBottom:10},
});
