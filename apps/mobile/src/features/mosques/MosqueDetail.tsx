import {useEffect,useState} from 'react';
import {
  ActivityIndicator,Alert,Linking,Modal,Pressable,ScrollView,
  Share,StyleSheet,Text,View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Feather,MaterialCommunityIcons} from '@expo/vector-icons';
import {Image} from 'expo-image';
import {
  type MosqueRecord,formatMosqueDistance,osmDetailURL,walkingDirectionsURL,
} from '@camideyiz/core';
import {useAppTheme} from '@/theme/ThemeProvider';
import {MosqueCrest,ArabesqueCorner} from '@/components/LuxuryArtwork';
import {loadCommonsPhoto,type CommonsPhoto} from './commonsPhoto';

type Props={place:MosqueRecord|null;isFavorite:boolean;onClose:()=>void;onFavorite:(place:MosqueRecord)=>void};
async function openLink(url:string){
  try{await Linking.openURL(url);}
  catch{Alert.alert('Bağlantı açılamadı','Cihazınızdaki harita veya tarayıcıyı kontrol edin.');}
}
function Action({icon,label,onPress,primary=false}:{
  icon:'navigation'|'heart'|'external-link'|'phone'|'share-2'|'globe';
  label:string;onPress:()=>void;primary?:boolean;
}){
  const {colors}=useAppTheme();
  return <Pressable accessibilityRole="button" onPress={onPress}
    style={[styles.action,{
      borderColor:primary?'transparent':colors.border,
      backgroundColor:primary?(colors.isDark?'#087B63':'#087658'):colors.surface,
    }]}>
    <Feather name={icon} size={16} color={primary?'#FFF':colors.emerald}/>
    <Text style={{color:primary?'#FFF':colors.text,fontSize:13,fontWeight:'800'}}>{label}</Text>
  </Pressable>;
}
function Feature({icon,title,value}:{
  icon:'check-circle'|'help-circle'|'clock'|'map-pin';title:string;value:string;
}){
  const {colors}=useAppTheme();
  return <View style={[styles.feature,{borderColor:colors.border,backgroundColor:colors.soft}]}>
    <Feather name={icon} size={16} color={colors.gold}/>
    <View style={{flex:1,gap:3}}>
      <Text style={{color:colors.muted,fontSize:10}}>{title}</Text>
      <Text style={{color:colors.text,fontSize:12,fontWeight:'700'}}>{value}</Text>
    </View>
  </View>;
}
export function MosqueDetail({place,isFavorite,onClose,onFavorite}:Props){
  const {colors}=useAppTheme();
  const [photo,setPhoto]=useState<CommonsPhoto|null>(null);
  const [loadingPhoto,setLoadingPhoto]=useState(false);
  useEffect(()=>{
    let live=true;setPhoto(null);
    if(!place?.commonsFile){setLoadingPhoto(false);return;}
    setLoadingPhoto(true);
    loadCommonsPhoto(place.commonsFile).then(data=>{if(live)setPhoto(data);})
      .finally(()=>{if(live)setLoadingPhoto(false);});
    return ()=>{live=false;};
  },[place?.id,place?.commonsFile]);
  if(!place)return null;
  const nearby=place.distanceMeters<20000;
  const credit='© OpenStreetMap katkıda bulunanlar (ODbL)';
  const navigate=()=>openLink(walkingDirectionsURL(place));
  const share=()=>Share.share({message:place.name+'\n'+
    (place.address?place.address+'\n':'')+
    'Haritada: '+osmDetailURL(place)}).catch(()=>undefined);
  const wheelchair=place.wheelchair==='yes'?'Erişilebilir olarak işaretli':
    place.wheelchair==='limited'?'Kısmen erişilebilir olarak işaretli':
    place.wheelchair==='no'?'Erişilebilir değil olarak işaretli':null;
  return <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <SafeAreaView edges={['top','bottom']} style={{flex:1,backgroundColor:colors.canvas}}>
      <View style={[styles.top,{borderBottomColor:colors.border}]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cami detayından çık"
          onPress={onClose} style={[styles.iconButton,{borderColor:colors.border}]}>
          <Feather name="x" color={colors.text} size={22}/>
        </Pressable>
        <Text style={{fontFamily:'serif',fontSize:20,fontWeight:'700',color:colors.text}}>Cami Detayı</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={isFavorite?'Favorilerden çıkar':'Favorilere ekle'}
          onPress={()=>onFavorite(place)}
          style={[styles.iconButton,{borderColor:colors.border}]}>
          <Feather name="heart" size={20} color={isFavorite?'#D76B6C':colors.gold}/>
        </Pressable>
      </View>
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom:36,paddingHorizontal:16,gap:15}}>
        <View style={[styles.cover,{backgroundColor:colors.isDark?'#113D37':'#E8EBDD',borderColor:colors.border}]}>
          {photo?<Image source={{uri:photo.url}} style={StyleSheet.absoluteFill}
            contentFit="cover" transition={240} cachePolicy="memory-disk" accessibilityLabel={place.name+' fotoğrafı'}/>
            :<View style={styles.crest}>
              <ArabesqueCorner dark={colors.isDark} width={145}/>
              <MosqueCrest width={240} dark={colors.isDark}/>
              <Text style={{fontSize:10,color:colors.muted,marginTop:4}}>
                {loadingPhoto?'Lisanslı fotoğraf aranıyor…':'Doğrulanmış fotoğraf bulunmuyor'}
              </Text>
            </View>}
          <View style={[styles.sourcePill,{backgroundColor:'rgba(8,32,29,.82)'}]}>
            <Feather name={photo?'image':'map-pin'} size={12} color="#F8E8C1"/>
            <Text style={{color:'#F8E8C1',fontSize:10,fontWeight:'700'}}>
              {photo?'Wikimedia Commons':'OpenStreetMap'}
            </Text>
          </View>
        </View>
        <View style={{gap:8,paddingHorizontal:3}}>
          <Text style={{fontFamily:'serif',fontWeight:'700',fontSize:28,
            letterSpacing:-.5,color:colors.text}}>{place.name}</Text>
          <View style={{flexDirection:'row',alignItems:'center',gap:7,flexWrap:'wrap'}}>
            <MaterialCommunityIcons name="mosque" color={colors.gold} size={17}/>
            <Text style={{fontSize:12,color:colors.muted}}>Cami / Mescit</Text>
            {nearby?<Text style={{color:colors.gold,fontSize:12}}>· {formatMosqueDistance(place.distanceMeters)}</Text>:null}
          </View>
          <Text style={{fontSize:13,lineHeight:22,color:colors.muted}}>
            {place.address??'Açık adres bu kayıt için belirtilmemiş. Konumu haritada görebilirsiniz.'}
          </Text>
        </View>
        <View style={{flexDirection:'row',gap:9}}>
          <View style={{flex:1}}><Action icon="navigation" label="Yol tarifi" onPress={navigate} primary/></View>
          <View style={{flex:1}}><Action icon="share-2" label="Paylaş" onPress={share}/></View>
        </View>
        <View style={{gap:9}}>
          <Text style={{fontFamily:'serif',fontSize:18,fontWeight:'700',color:colors.text}}>Konum ve bilgiler</Text>
          <Feature icon="map-pin" title="Koordinatlar"
            value={place.latitude.toFixed(5)+'°, '+place.longitude.toFixed(5)+'°'}/>
          {wheelchair?<Feature icon="check-circle" title="Erişilebilirlik (OSM kaydı)" value={wheelchair}/>:null}
          {place.ablution!==null?<Feature icon="check-circle" title="Abdest imkânı (OSM kaydı)"
            value={place.ablution?'Var olarak işaretli':'Yok olarak işaretli'}/>:null}
          {place.womenArea!==null?<Feature icon="check-circle" title="Kadınlar için namaz alanı (OSM kaydı)"
            value={place.womenArea?'Var olarak işaretli':'Yok olarak işaretli'}/>:null}
          {place.openingHours?<Feature icon="clock" title="Bildirilen ziyaret saatleri"
            value={place.openingHours}/>:null}
          {place.description?<Text style={{color:colors.muted,fontSize:12,lineHeight:20}}>
            {place.description}
          </Text>:null}
        </View>
        {place.phone||place.website?<View style={{flexDirection:'row',gap:9,flexWrap:'wrap'}}>
          {place.phone?<Action icon="phone" label="Telefon" onPress={()=>openLink('tel:'+place.phone!.replace(/[^\d+]/g,''))}/>:null}
          {place.website?<Action icon="globe" label="Web sitesi" onPress={()=>openLink(place.website!)}/>:null}
        </View>:null}
        {photo?<View style={[styles.license,{borderColor:colors.border}]}>
          <Text style={{color:colors.text,fontSize:12,fontWeight:'800'}}>Fotoğraf lisansı ve kaynak</Text>
          <Text style={{color:colors.muted,fontSize:11,lineHeight:19}}>
            {photo.credit} · {photo.license}
          </Text>
          <Pressable accessibilityRole="link" onPress={()=>openLink(photo.descriptionUrl)}>
            <Text style={{fontSize:12,color:colors.emerald,fontWeight:'700'}}>Wikimedia dosya ve lisans bilgilerini aç</Text>
          </Pressable>
        </View>:null}
        <View style={[styles.license,{borderColor:colors.border}]}>
          <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
            <Feather name="shield" size={15} color={colors.gold}/>
            <Text style={{fontSize:12,fontWeight:'700',color:colors.text}}>Veri kaynağı ve doğruluk</Text>
          </View>
          <Text style={{color:colors.muted,fontSize:11,lineHeight:19}}>
            Bu kayıt OpenStreetMap topluluk verisinden gelir. Adres, erişilebilirlik ve tesis bilgileri eksik veya güncel olmayabilir.
          </Text>
          <Pressable accessibilityRole="link" onPress={()=>openLink(osmDetailURL(place))}>
            <Text style={{color:colors.emerald,fontSize:12,fontWeight:'700'}}>Orijinal OpenStreetMap kaydını aç</Text>
          </Pressable>
          <Pressable accessibilityRole="link" onPress={()=>openLink('https://www.openstreetmap.org/copyright')}>
            <Text style={{color:colors.muted,fontSize:10}}>{credit}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}
const styles=StyleSheet.create({
  top:{height:64,flexDirection:'row',alignItems:'center',justifyContent:'space-between',
    borderBottomWidth:1,paddingHorizontal:16,marginBottom:14},
  iconButton:{height:39,width:39,borderRadius:14,borderWidth:1,justifyContent:'center',alignItems:'center'},
  cover:{height:240,borderRadius:24,overflow:'hidden',borderWidth:1,justifyContent:'center'},
  crest:{flex:1,alignItems:'center',justifyContent:'center'},
  sourcePill:{position:'absolute',left:13,bottom:13,paddingVertical:7,paddingHorizontal:11,
    flexDirection:'row',alignItems:'center',gap:6,borderRadius:18},
  action:{height:49,borderWidth:1,borderRadius:15,paddingHorizontal:13,
    flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
  feature:{borderWidth:1,borderRadius:14,padding:12,flexDirection:'row',alignItems:'center',gap:12},
  license:{borderTopWidth:1,paddingTop:14,marginTop:3,gap:7},
});
