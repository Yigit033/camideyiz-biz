import {memo,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {
  ActivityIndicator,Alert,FlatList,Keyboard,Linking,Platform,Pressable,ScrollView,
  StyleSheet,Text,TextInput,View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import MapView,{Marker,PROVIDER_GOOGLE,type Region} from 'react-native-maps';
import {Feather,MaterialCommunityIcons} from '@expo/vector-icons';
import {
  type GoogleMosque,type GoogleMosqueDetails,ISTANBUL_CENTER,
  distanceMeters,googleSearchRadius,formatMosqueDistance,
} from '@camideyiz/core';
import {useAppTheme} from '@/theme/ThemeProvider';
import {Atmosphere,MosqueCrest} from '@/components/LuxuryArtwork';
import {GoogleMosqueCard} from '@/features/mosques/GoogleMosqueCard';
import {GoogleMosqueDetail} from '@/features/mosques/GoogleMosqueDetail';
import {useGoogleMosqueFavorites} from '@/features/mosques/useGoogleMosqueFavorites';
import {configuredGooglePlaces,getGoogleMosqueDetails,searchGoogleMosques} from '@/features/mosques/googlePlacesClient';

const INITIAL:Region={...ISTANBUL_CENTER,latitudeDelta:.18,longitudeDelta:.18};
const GOOGLE_MAPS_READY=Platform.OS==='android'||
  (Platform.OS==='ios'&&Constants.appOwnership!=='expo'&&
    Constants.expoConfig?.extra?.googleMapsIosConfigured===true);
const DARK_MAP_STYLE:NonNullable<React.ComponentProps<typeof MapView>['customMapStyle']>=[
  {elementType:'geometry',stylers:[{color:'#1B332F'}]},
  {elementType:'labels.text.fill',stylers:[{color:'#D5E1D8'}]},
  {elementType:'labels.text.stroke',stylers:[{color:'#172D2A'}]},
  {featureType:'water',elementType:'geometry',stylers:[{color:'#0E2630'}]},
  {featureType:'road',elementType:'geometry',stylers:[{color:'#34554C'}]},
  {featureType:'poi',stylers:[{visibility:'off'}]},
];
type Mode='map'|'list';
const NativeMosqueMap=memo(function NativeMosqueMap({
  regionRef,onMove,places,selected,onSelect,mapRef,showLocation,dark,
}:{
  regionRef:{current:Region};onMove:(region:Region)=>void;
  places:GoogleMosque[];selected:string|null;onSelect:(place:GoogleMosque)=>void;
  mapRef:React.RefObject<MapView|null>;showLocation:boolean;dark:boolean;
}){
  return <MapView
    ref={mapRef} provider={PROVIDER_GOOGLE}
    initialRegion={regionRef.current}
    style={StyleSheet.absoluteFill}
    customMapStyle={dark?DARK_MAP_STYLE:undefined}
    showsUserLocation={showLocation}
    showsMyLocationButton={false}
    showsCompass
    mapPadding={{top:18,left:12,right:12,bottom:35}}
    moveOnMarkerPress={false}
    onRegionChangeComplete={onMove}>
    {places.map(place=><Marker
      key={place.id} identifier={place.id}
      coordinate={{latitude:place.latitude,longitude:place.longitude}}
      title={place.name} description={place.address??undefined}
      pinColor={selected===place.id?'#D5A45E':'#087E63'}
      onPress={()=>onSelect(place)}/>)}
  </MapView>;
});
function ErrorExplanation({message,onRetry}: {message:string;onRetry:()=>void}){
  const {colors}=useAppTheme();
  return <Pressable accessibilityRole="button" onPress={onRetry}
    style={[styles.error,{backgroundColor:colors.surface,borderColor:colors.border}]}>
    <Feather name="alert-circle" size={19} color={colors.warning}/>
    <Text style={{color:colors.text,fontSize:12,flex:1,lineHeight:18}}>{message}</Text>
    <Feather name="refresh-cw" size={16} color={colors.emerald}/>
  </Pressable>;
}
export default function MosquesScreen(){
  const {colors}=useAppTheme();
  const mapRef=useRef<MapView>(null),regionRef=useRef<Region>(INITIAL);
  const mounted=useRef(true),controller=useRef<AbortController|null>(null);
  const initialSearch=useRef(false),sequence=useRef(0),favoritesLoading=useRef(false);
  const [mode,setMode]=useState<Mode>('map');
  const [places,setPlaces]=useState<GoogleMosque[]>([]);
  const [favoritePlaces,setFavoritePlaces]=useState<GoogleMosque[]>([]);
  const [filter,setFilter]=useState<'all'|'favorites'>('all');
  const [query,setQuery]=useState(''),[searchText,setSearchText]=useState('');
  const [selected,setSelected]=useState<GoogleMosque|null>(null);
  const [detail,setDetail]=useState<GoogleMosque|null>(null);
  const [searchCenter,setSearchCenter]=useState<{latitude:number;longitude:number}|null>(null);
  const [areaChanged,setAreaChanged]=useState(true);
  const [loading,setLoading]=useState(false),[locating,setLocating]=useState(false);
  const [favoritesBusy,setFavoritesBusy]=useState(false);
  const [error,setError]=useState<string|null>(null),[hasLocation,setHasLocation]=useState(false);
  const {ids,items:favoriteIds,toggle}=useGoogleMosqueFavorites();
  useEffect(()=>()=>{mounted.current=false;controller.current?.abort();sequence.current++;},[]);

  const perform=useCallback(async(center:{latitude:number;longitude:number},latitudeDelta:number,q='')=>{
    const token=++sequence.current;
    controller.current?.abort();
    const ctrl=new AbortController();
    controller.current=ctrl;
    Keyboard.dismiss();setLoading(true);setError(null);setSelected(null);
    try{
      const result=await searchGoogleMosques(center.latitude,center.longitude,googleSearchRadius(latitudeDelta),q,ctrl.signal);
      if(ctrl.signal.aborted||!mounted.current||token!==sequence.current)return;
      setPlaces(result.places);
      setSearchCenter(result.center);setAreaChanged(false);
      setSearchText(q.trim());
    }catch(e){
      if(ctrl.signal.aborted||!mounted.current||token!==sequence.current)return;
      const code=e instanceof Error?e.message:'';
      const message=code==='GOOGLE_PLACES_SERVER_NOT_CONFIGURED'?
        'Google Places sunucusu henüz bağlı değil. API adresini ve Google Cloud anahtarlarını yapılandırın.':
        code==='google_places_not_configured'?
          'Google Cloud Places API anahtarı sunucuda bulunmuyor.':
        code==='query_rate_limited'||code==='provider_quota'?
          'Arama sınırına ulaşıldı. Daha sonra yeniden deneyin.':
          'Google Places cami sonuçlarına ulaşılamadı. Bağlantıyı kontrol edin.';
      setError(message);
    }finally{
      if(mounted.current&&token===sequence.current)setLoading(false);
    }
  },[]);
  const searchArea=useCallback(()=>{
    const r=regionRef.current;
    perform({latitude:r.latitude,longitude:r.longitude},r.latitudeDelta,query);
  },[perform,query]);

  const onMove=useCallback((r:Region)=>{
    regionRef.current=r;
    const center={latitude:r.latitude,longitude:r.longitude};
    // This callback performs no network request or heavy record parsing.
    const isDifferent=!searchCenter||
      distanceMeters(center,searchCenter)>380||
      googleSearchRadius(r.latitudeDelta)>googleSearchRadius(INITIAL.latitudeDelta)+500;
    setAreaChanged(old=>old===isDifferent?old:isDifferent);
  },[searchCenter]);
  const locate=useCallback(async()=>{
    setLocating(true);
    try{
      const permission=await Location.requestForegroundPermissionsAsync();
      if(permission.status!=='granted'){
        Alert.alert('Konum izni verilmedi','Haritayı kaydırıp istediğiniz bölgede arama yapabilirsiniz.');
        return;
      }
      const position=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
      const center={latitude:position.coords.latitude,longitude:position.coords.longitude};
      const r:Region={...center,latitudeDelta:.065,longitudeDelta:.065};
      regionRef.current=r;setHasLocation(true);
      mapRef.current?.animateToRegion(r,350);
      await perform(center,r.latitudeDelta,query);
    }catch{Alert.alert('Konum alınamadı','Konum servislerini kontrol edin veya haritayı elle taşıyın.');}
    finally{if(mounted.current)setLocating(false);}
  },[perform,query]);
  const visible=useMemo(()=>{
    const list=filter==='favorites'?favoritePlaces:places;
    return list.filter(p=>!searchText||p.name.toLocaleLowerCase('tr-TR').includes(searchText.toLocaleLowerCase('tr-TR'))||
      (p.address??'').toLocaleLowerCase('tr-TR').includes(searchText.toLocaleLowerCase('tr-TR')));
  },[places,favoritePlaces,filter,searchText]);
  const choose=useCallback((p:GoogleMosque)=>{
    setSelected(p);setDetail(null);
  },[]);
  const selectFavoriteTab=useCallback(async()=>{
    setFilter('favorites');setSelected(null);
    if(!favoriteIds.length){setFavoritePlaces([]);return;}
    if(favoritesLoading.current)return;
    favoritesLoading.current=true;setFavoritesBusy(true);
    // Place IDs are the only persisted data. Names/location are refetched
    // on explicit user action to comply with Google Maps caching policy.
    try{
      const groups=favoriteIds.slice(0,20);
      const resolved:GoogleMosque[]=[];
      // Fetch in small batches to avoid blocking UI or creating a burst.
      for(let i=0;i<groups.length;i+=3){
        if(!mounted.current)break;
        const batch=await Promise.allSettled(groups.slice(i,i+3).map(id=>getGoogleMosqueDetails(id)));
        batch.forEach(x=>{if(x.status==='fulfilled'){
          const d=x.value;
          resolved.push({...d,distanceMeters:distanceMeters(regionRef.current,d)});
        }});
        if(mounted.current)setFavoritePlaces([...resolved]);
      }
    }finally{favoritesLoading.current=false;if(mounted.current)setFavoritesBusy(false);}
  },[favoriteIds]);
  const label=searchCenter?'Google Places · '+places.length+' sonuç':'Haritada bir alan seçin';
  const unavailable=!GOOGLE_MAPS_READY;
  if(unavailable){
    return <SafeAreaView edges={['top']} style={{flex:1,backgroundColor:colors.canvas}}>
      <Atmosphere dark={colors.isDark}/>
      <View style={styles.setup}>
        <MosqueCrest width={220} dark={colors.isDark}/>
        <Text style={{fontFamily:'serif',fontSize:25,fontWeight:'700',color:colors.text,textAlign:'center'}}>
          Google Maps haritası
        </Text>
        <Text style={{color:colors.muted,lineHeight:22,textAlign:'center'}}>
          iOS Expo Go uygulaması Google Maps iOS SDK'sını içermez. Google Places verilerini Apple Maps üzerinde göstermiyoruz.
          iOS'ta Google Maps kullanmak için Google SDK anahtarıyla özel geliştirme derlemesi oluşturmalısınız.
        </Text>
      </View>
    </SafeAreaView>;
  }
  return <SafeAreaView edges={['top']} style={{flex:1,backgroundColor:colors.canvas}}>
    <Atmosphere dark={colors.isDark}/>
    <View style={styles.heading}>
      <View style={{flex:1,gap:3}}>
        <Text style={{color:colors.gold,letterSpacing:2,fontSize:9,fontWeight:'800'}}>HARİTADA KEŞFET</Text>
        <Text style={{fontFamily:'serif',fontSize:29,fontWeight:'700',color:colors.text}}>Camiler</Text>
      </View>
      <Pressable onPress={locate} disabled={locating}
        accessibilityRole="button" accessibilityLabel="Konumumda cami ara"
        style={[styles.iconButton,{backgroundColor:colors.surface,borderColor:colors.border}]}>
        {locating?<ActivityIndicator color={colors.emerald}/>
          :<MaterialCommunityIcons name="crosshairs-gps" color={colors.emerald} size={23}/>}
      </Pressable>
    </View>
    <View style={[styles.searchBox,{backgroundColor:colors.surface,borderColor:colors.border}]}>
      <Feather name="search" size={18} color={colors.gold}/>
      <TextInput value={query} onChangeText={setQuery}
        placeholder="Cami veya bölge adı yaz…" placeholderTextColor={colors.muted}
        returnKeyType="search" onSubmitEditing={searchArea}
        style={{flex:1,fontSize:14,color:colors.text}} autoCorrect={false}/>
      {query?<Pressable onPress={()=>{setQuery('');setSearchText('');}} accessibilityLabel="Aramayı temizle">
        <Feather name="x" color={colors.muted} size={16}/>
      </Pressable>:null}
      <Pressable onPress={searchArea} accessibilityRole="button" disabled={loading}
        style={{backgroundColor:colors.isDark?'#126D55':'#0C7858',padding:9,borderRadius:11}}>
        <Feather name="arrow-right" color="#FFF" size={18}/>
      </Pressable>
    </View>
    <View style={styles.controls}>
      <View style={[styles.tabs,{backgroundColor:colors.soft,borderColor:colors.border}]}>
        {(['map','list'] as Mode[]).map(key=><Pressable key={key}
          onPress={()=>setMode(key)} accessibilityRole="button" accessibilityState={{selected:mode===key}}
          style={[styles.tab,{backgroundColor:mode===key?colors.surface:'transparent'}]}>
          <Feather name={key==='map'?'map':'list'} size={15} color={mode===key?colors.emerald:colors.muted}/>
          <Text style={{fontWeight:'700',fontSize:12,color:mode===key?colors.text:colors.muted}}>
            {key==='map'?'Harita':'Liste'}
          </Text>
        </Pressable>)}
      </View>
      <View style={{flexDirection:'row',gap:6}}>
        <Pressable onPress={()=>{setFilter('all');setSelected(null);}}
          style={[styles.smallFilter,{borderColor:filter==='all'?colors.gold:colors.border,backgroundColor:colors.surface}]}>
          <Text style={{fontSize:11,fontWeight:'700',color:colors.text}}>Tümü</Text>
        </Pressable>
        <Pressable onPress={selectFavoriteTab}
          style={[styles.smallFilter,{borderColor:filter==='favorites'?colors.gold:colors.border,backgroundColor:colors.surface}]}>
          <Feather name="heart" size={13} color={colors.gold}/>
          <Text style={{fontSize:11,fontWeight:'700',color:colors.text}}>Favoriler</Text>
        </Pressable>
      </View>
    </View>
    <Text style={{marginHorizontal:18,marginBottom:6,fontSize:10,color:colors.muted}}>
      {filter==='favorites'?'Kaydedilen konumlar · Google Places':label} · Her aramada en fazla 20 sonuç
    </Text>
    <View style={{flex:1,minHeight:230}}>
      <View style={[styles.mapFrame,{
        display:mode==='map'?'flex':'none',borderColor:colors.border,
      }]}>
        <NativeMosqueMap
          regionRef={regionRef} mapRef={mapRef} places={visible}
          selected={selected?.id??null} onMove={onMove} onSelect={choose}
          showLocation={hasLocation} dark={colors.isDark}/>
        <View pointerEvents="none" style={styles.target}>
          <Feather name="plus" size={24} color="#086C54"/>
        </View>
        <Pressable onPress={searchArea} accessibilityRole="button" disabled={loading}
          style={[styles.areaButton,{backgroundColor:colors.isDark?'#123F35':'#FFFFFF',borderColor:colors.gold}]}>
          {loading?<ActivityIndicator size="small" color={colors.emerald}/>:<Feather name="search" color={colors.emerald} size={17}/>}
          <Text style={{color:colors.text,fontWeight:'800',fontSize:13}}>
            {loading?'Camiler aranıyor…':'Bu bölgede ara'}
          </Text>
        </Pressable>
        {error?<ErrorExplanation message={error} onRetry={searchArea}/>:null}
        {!places.length&&!loading&&!error&&filter==='all'?<View style={[styles.hint,{backgroundColor:colors.surface,borderColor:colors.border}]}>
          <Text style={{color:colors.text,fontSize:11,textAlign:'center',lineHeight:18}}>
            Haritayı kaydır, yakınlaştır veya konumunu seç. Ardından “Bu bölgede ara” düğmesine dokun.
          </Text>
        </View>:null}
        {selected?<View style={[styles.selected,{backgroundColor:colors.surface,borderColor:colors.border}]}>
          <View style={[styles.miniArt,{backgroundColor:colors.soft}]}>
            <MosqueCrest width={70} dark={colors.isDark}/>
          </View>
          <Pressable accessibilityRole="button" onPress={()=>setDetail(selected)} style={{flex:1,gap:5}}>
            <Text numberOfLines={1} style={{fontFamily:'serif',fontSize:17,fontWeight:'700',color:colors.text}}>{selected.name}</Text>
            <Text numberOfLines={1} style={{fontSize:11,color:colors.muted}}>{selected.address??'Google Maps konumu'}</Text>
            <Text style={{fontSize:11,color:colors.emerald,fontWeight:'800'}}>
              {formatMosqueDistance(selected.distanceMeters)} · Detayı aç
            </Text>
          </Pressable>
          <Pressable onPress={()=>setDetail(selected)} accessibilityLabel="Cami detayını aç">
            <Feather name="arrow-up-right" color={colors.emerald} size={21}/>
          </Pressable>
        </View>:null}
      </View>
      {mode==='list'?<FlatList data={visible} keyExtractor={p=>p.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{padding:14,gap:8,flexGrow:1}}
        ListHeaderComponent={<Text style={{fontSize:11,color:colors.muted,marginBottom:4}}>
          Veriler Google Maps tarafından sağlanmaktadır.
        </Text>}
        renderItem={({item})=><GoogleMosqueCard
          place={item} favorite={ids.has(item.id)}
          open={()=>setDetail(item)} toggle={()=>toggle(item.id)}/>}
        ListEmptyComponent={<View style={{alignItems:'center',gap:12,paddingTop:35}}>
          {favoritesBusy?<ActivityIndicator color={colors.emerald}/>:<MosqueCrest width={160} dark={colors.isDark}/>}
          <Text style={{color:colors.text,fontWeight:'700'}}>
            {filter==='favorites'?'Favoriler yükleniyor veya henüz kaydın yok':'Haritada bölge seçerek aramaya başla'}
          </Text>
        </View>}
        ListFooterComponent={<Text style={{textAlign:'center',fontSize:11,color:colors.muted,padding:20}}>
          Google Maps · Sonuçlar harita bölgesine ve Google Places kapsamına bağlıdır.
        </Text>}
      />:null}
    </View>
    <GoogleMosqueDetail place={detail} favorite={detail?ids.has(detail.id):false}
      toggle={toggle} close={()=>setDetail(null)}/>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  heading:{height:77,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  iconButton:{width:45,height:45,borderRadius:15,borderWidth:1,alignItems:'center',justifyContent:'center'},
  searchBox:{height:49,marginHorizontal:14,marginBottom:8,borderWidth:1,borderRadius:16,
    flexDirection:'row',alignItems:'center',paddingHorizontal:12,gap:10},
  controls:{minHeight:46,marginHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:6},
  tabs:{height:37,borderRadius:13,borderWidth:1,padding:3,flexDirection:'row',gap:3},
  tab:{paddingHorizontal:10,borderRadius:10,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5},
  smallFilter:{minHeight:34,paddingHorizontal:10,borderRadius:13,borderWidth:1,
    flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5},
  mapFrame:{flex:1,borderRadius:21,borderWidth:1,marginHorizontal:10,marginBottom:8,overflow:'hidden',
    backgroundColor:'#E5E9E3'},
  target:{position:'absolute',left:0,right:0,top:'47%',alignItems:'center',justifyContent:'center'},
  areaButton:{position:'absolute',top:17,alignSelf:'center',minHeight:43,
    borderWidth:1,borderRadius:23,paddingHorizontal:19,
    flexDirection:'row',alignItems:'center',gap:8,elevation:5,
    shadowColor:'#132D25',shadowOpacity:.2,shadowRadius:10},
  error:{position:'absolute',top:73,left:11,right:11,padding:12,borderRadius:15,
    borderWidth:1,flexDirection:'row',alignItems:'center',gap:9},
  hint:{position:'absolute',bottom:28,left:20,right:20,padding:12,borderWidth:1,borderRadius:14},
  selected:{position:'absolute',bottom:15,left:9,right:9,minHeight:94,padding:10,
    borderWidth:1,borderRadius:18,flexDirection:'row',alignItems:'center',gap:10,
    shadowColor:'#182E28',shadowOpacity:.15,shadowRadius:12,elevation:4},
  miniArt:{width:68,height:72,borderRadius:13,alignItems:'center',justifyContent:'center'},
  setup:{flex:1,paddingHorizontal:27,alignItems:'center',justifyContent:'center',gap:17},
});
