import {useEffect,useState} from 'react';
import {ActivityIndicator,Alert,Linking,Modal,Pressable,ScrollView,Share,StyleSheet,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Image} from 'expo-image';
import {Feather,MaterialCommunityIcons} from '@expo/vector-icons';
import {type GoogleMosque,type GoogleMosqueDetails,googleMapsPlaceURL,googleWalkingDirectionsURL} from '@camideyiz/core';
import {useAppTheme} from '@/theme/ThemeProvider';
import {MosqueCrest} from '@/components/LuxuryArtwork';
import {getGoogleMosqueDetails,googleMosquePhotoURL} from './googlePlacesClient';

type Props={
  place:GoogleMosque|null;favorite:boolean;toggle:(id:string)=>void;close:()=>void;
};
async function openURL(url:string){
  try{await Linking.openURL(url);}
  catch{Alert.alert('Bağlantı açılamadı','Lütfen cihazınızdaki tarayıcı veya harita ayarlarını kontrol edin.');}
}
export function GoogleMosqueDetail({place,favorite,toggle,close}:Props){
  const {colors}=useAppTheme();
  const [details,setDetails]=useState<GoogleMosqueDetails|null>(null);
  const [loading,setLoading]=useState(false);
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    if(!place){setDetails(null);setFailed(false);return;}
    const controller=new AbortController();
    setDetails(null);setFailed(false);setLoading(true);
    getGoogleMosqueDetails(place.id,controller.signal)
      .then(next=>{if(!controller.signal.aborted)setDetails(next);})
      .catch(()=>{if(!controller.signal.aborted)setFailed(true);})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[place?.id]);
  if(!place)return null;
  const photo=details?.photos[0];
  let photoURL:string|null=null;
  try{if(photo)photoURL=googleMosquePhotoURL(photo.name);}catch{/* invalid resource */}
  const navigate=()=>openURL(googleWalkingDirectionsURL(place));
  const share=()=>Share.share({message:place.name+'\n'+googleMapsPlaceURL(place.id)}).catch(()=>undefined);
  const action=(label:string,icon:'navigation'|'share-2'|'heart'|'external-link',onPress:()=>void,primary=false)=>
    <Pressable onPress={onPress} accessibilityRole="button" style={[styles.action,{
      backgroundColor:primary?(colors.isDark?'#07775C':'#087459'):colors.surface,
      borderColor:primary?'transparent':colors.border,
    }]}>
      <Feather name={icon} size={16} color={primary?'white':colors.emerald}/>
      <Text style={{color:primary?'white':colors.text,fontSize:13,fontWeight:'700'}}>{label}</Text>
    </Pressable>;
  const info=(title:string,value:string)=><View style={[styles.feature,{backgroundColor:colors.soft}]}>
    <Text style={{color:colors.muted,fontSize:11}}>{title}</Text>
    <Text style={{color:colors.text,fontSize:13,fontWeight:'600',lineHeight:20}}>{value}</Text>
  </View>;
  return <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
    <SafeAreaView edges={['top','bottom']} style={{flex:1,backgroundColor:colors.canvas}}>
      <View style={[styles.header,{borderBottomColor:colors.border}]}>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Detay ekranını kapat"
          style={[styles.headerButton,{borderColor:colors.border}]}>
          <Feather name="x" color={colors.text} size={22}/>
        </Pressable>
        <Text style={{fontFamily:'serif',fontSize:19,fontWeight:'700',color:colors.text}}>Cami Detayı</Text>
        <Pressable onPress={()=>toggle(place.id)} accessibilityRole="button"
          accessibilityLabel={favorite?'Favoriden çıkar':'Favorilere ekle'}
          style={[styles.headerButton,{borderColor:colors.border}]}>
          <Feather name="heart" size={21} color={favorite?'#DD7575':colors.gold}/>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={[styles.cover,{backgroundColor:colors.soft,borderColor:colors.border}]}>
          {photoURL
            ?<Image source={{uri:photoURL}} style={StyleSheet.absoluteFill}
              contentFit="cover" cachePolicy="none" accessibilityLabel={place.name+' fotoğrafı'}/>
            :<View style={{alignItems:'center',justifyContent:'center',flex:1,gap:8}}>
              <MosqueCrest width={215} dark={colors.isDark}/>
              <Text style={{color:colors.muted,fontSize:11}}>
                {loading?'Fotoğraf bilgisi alınıyor…':'Bu caminin doğrulanmış fotoğrafı yok'}
              </Text>
            </View>}
          <View style={styles.sourceBadge}>
            <MaterialCommunityIcons name="google-maps" color="#FFF2D8" size={16}/>
            <Text style={{color:'#FFF2D8',fontSize:11,fontWeight:'700'}}>Google Maps</Text>
          </View>
        </View>
        {photo?.attributions?.length?<View style={[styles.credit,{borderColor:colors.border}]}>
          <Text style={{color:colors.muted,fontSize:11,lineHeight:17}}>Fotoğraf: {photo.attributions.map(a=>a.displayName).join(', ')}</Text>
          {photo.attributions.filter(a=>!!a.uri).map((a,i)=><Pressable key={i} onPress={()=>a.uri&&openURL(a.uri.startsWith('//')?'https:'+a.uri:a.uri)}>
            <Text style={{color:colors.emerald,fontSize:11}}>Fotoğraf sahibi / kaynak bağlantısı</Text>
          </Pressable>)}
        </View>:null}
        <Text style={{fontFamily:'serif',fontWeight:'700',fontSize:26,color:colors.text}}>{place.name}</Text>
        <View style={{flexDirection:'row',alignItems:'center',gap:7}}>
          <MaterialCommunityIcons name="mosque" color={colors.gold} size={17}/>
          <Text style={{color:colors.muted,fontSize:12}}>Google Maps'teki cami kaydı</Text>
        </View>
        <Text style={{color:colors.muted,fontSize:13,lineHeight:21}}>
          {details?.address??place.address??'Açık adres mevcut değil. Haritada yol tarifi kullanabilirsiniz.'}
        </Text>
        <View style={{flexDirection:'row',gap:9,marginVertical:6}}>
          <View style={{flex:1}}>{action('Yol tarifi','navigation',navigate,true)}</View>
          <View style={{flex:1}}>{action('Paylaş','share-2',share)}</View>
        </View>
        {loading?<View style={{flexDirection:'row',alignItems:'center',gap:8}}>
          <ActivityIndicator size="small" color={colors.emerald}/>
          <Text style={{color:colors.muted,fontSize:12}}>Google Places detayları alınıyor…</Text>
        </View>:null}
        {failed?info('Detay bilgileri','Ek bilgiler alınamadı. Yol tarifi ve Google Maps bağlantısı kullanılabilir.'):null}
        {details?.phone?info('Telefon',details.phone):null}
        {details?.accessibleEntrance!==null&&details?.accessibleEntrance!==undefined
          ?info('Erişilebilir giriş',details.accessibleEntrance?'Google kaydında erişilebilir':'Google kaydında erişilebilir değil'):null}
        {details?.openingHours?.length?info('Google Maps’te bildirilen saatler',details.openingHours.join('\n')):null}
        {details?.website?<Pressable onPress={()=>openURL(details.website!)}
          accessibilityRole="link" style={[styles.action,{backgroundColor:colors.soft,borderColor:colors.border}]}>
          <Feather name="globe" color={colors.emerald} size={16}/>
          <Text style={{color:colors.text,fontWeight:'700'}}>Web sitesini aç</Text>
        </Pressable>:null}
        <Pressable accessibilityRole="link" onPress={()=>openURL(details?.googleMapsUri??googleMapsPlaceURL(place.id))}
          style={[styles.action,{backgroundColor:colors.soft,borderColor:colors.border}]}>
          <MaterialCommunityIcons name="google-maps" size={17} color={colors.emerald}/>
          <Text style={{color:colors.text,fontWeight:'700'}}>Google Maps'te görüntüle</Text>
        </Pressable>
        <View style={[styles.disclaimer,{borderTopColor:colors.border}]}>
          <Text style={{color:colors.text,fontSize:12,fontWeight:'700'}}>Veri kaynağı: Google Maps</Text>
          <Text style={{fontSize:11,color:colors.muted,lineHeight:18}}>
            Cami bilgileri Google Places tarafından sağlanır. Eksik veya güncel olmayan kayıtlar olabilir.
            Fotoğraflar ve içerik Google Maps kullanım koşullarına tabidir.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}
const styles=StyleSheet.create({
  header:{height:64,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:17,borderBottomWidth:1},
  headerButton:{width:40,height:40,borderWidth:1,borderRadius:13,alignItems:'center',justifyContent:'center'},
  body:{paddingHorizontal:16,paddingTop:14,paddingBottom:40,gap:11},
  cover:{height:230,borderRadius:25,borderWidth:1,overflow:'hidden'},
  sourceBadge:{position:'absolute',left:12,bottom:12,backgroundColor:'rgba(7,40,34,.84)',paddingHorizontal:12,paddingVertical:6,
    borderRadius:13,flexDirection:'row',gap:6,alignItems:'center'},
  credit:{padding:9,borderWidth:1,borderRadius:12,gap:5},
  action:{minHeight:47,borderRadius:14,borderWidth:1,flexDirection:'row',gap:9,alignItems:'center',justifyContent:'center',paddingHorizontal:12},
  feature:{borderRadius:14,padding:13,gap:5},
  disclaimer:{borderTopWidth:1,paddingTop:13,marginTop:7,gap:6},
});
