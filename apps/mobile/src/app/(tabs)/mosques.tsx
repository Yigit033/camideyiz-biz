import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {
  ActivityIndicator,Alert,FlatList,Linking,Pressable,ScrollView,
  StyleSheet,Text,TextInput,View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Feather,MaterialCommunityIcons} from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView,{Marker,type Region} from 'react-native-maps';
import {
  ISTANBUL_CENTER, type Coordinate,type MosqueFilter,type MosqueRecord,
  distanceMeters,filterMosques,formatMosqueDistance,MOSQUE_RADIUS_METERS,
} from '@camideyiz/core';
import {useAppTheme} from '@/theme/ThemeProvider';
import {Atmosphere,MosqueCrest} from '@/components/LuxuryArtwork';
import {MosqueCard} from '@/features/mosques/MosqueCard';
import {MosqueDetail} from '@/features/mosques/MosqueDetail';
import {loadMosques,type MosqueSearchResult} from '@/features/mosques/mosqueRepository';
import {useMosqueFavorites} from '@/features/mosques/useMosqueFavorites';

const DEFAULT_REGION:Region={...ISTANBUL_CENTER,latitudeDelta:.075,longitudeDelta:.075};
const FILTERS:{key:MosqueFilter;label:string;icon:'grid'|'heart'|'image'|'accessibility'}[]=[
  {key:'all',label:'Tümü',icon:'grid'},
  {key:'favorites',label:'Favoriler',icon:'heart'},
  {key:'photographed',label:'Fotoğraf etiketi',icon:'image'},
  {key:'accessible',label:'Erişilebilir',icon:'accessibility'},
];
const GOOGLE_NIGHT_STYLE=[
  {elementType:'geometry',stylers:[{color:'#172E2B'}]},
  {elementType:'labels.text.fill',stylers:[{color:'#B8CFC0'}]},
  {elementType:'labels.text.stroke',stylers:[{color:'#19322F'}]},
  {featureType:'water',elementType:'geometry',stylers:[{color:'#0C222B'}]},
  {featureType:'road',elementType:'geometry',stylers:[{color:'#2C4F46'}]},
  {featureType:'poi',stylers:[{visibility:'off'}]},
] as const;
function formatFetchTime(time:number){
  const elapsed=Math.max(0,Date.now()-time);
  if(elapsed<60*60*1000)return 'Güncel bölge verisi';
  if(elapsed<24*60*60*1000)return 'Önbellek · '+Math.floor(elapsed/(60*60*1000))+' sa önce';
  return 'Önbellek · '+Math.floor(elapsed/(24*60*60*1000))+' gün önce';
}
function Chip({label,selected,onPress,icon}:{
  label:string;selected:boolean;onPress:()=>void;icon:typeof FILTERS[number]['icon'];
}){
  const {colors}=useAppTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{selected}} onPress={onPress}
    style={[styles.chip,{
      backgroundColor:selected?(colors.isDark?'#08745E':'#087557'):colors.surface,
      borderColor:selected?(colors.isDark?'#78D0A9':'#087557'):colors.border,
    }]}>
    <Feather name={icon} size={13} color={selected?'#FFEDC9':colors.gold}/>
    <Text style={{fontSize:11,fontWeight:'700',color:selected?'#FFFEF9':colors.text}}>{label}</Text>
  </Pressable>;
}
function MosquePin({focused}: {focused:boolean}){
  const {colors}=useAppTheme();
  return <View style={{alignItems:'center',justifyContent:'center',height:53,width:45}}>
    <View style={{
      width:focused?42:35,height:focused?42:35,borderRadius:focused?19:16,
      borderWidth:focused?3:2,borderColor:focused?'#F4D391':colors.isDark?'#CDB77F':'#FFFFFF',
      backgroundColor:focused?'#08795C':colors.isDark?'#0F564A':'#10785B',
      alignItems:'center',justifyContent:'center',
      shadowColor:'#0C342D',shadowOpacity:.25,shadowRadius:6,elevation:4,
    }}>
      <MaterialCommunityIcons name="mosque" color="#FFF4D8" size={focused?22:18}/>
    </View>
    <View style={{width:8,height:8,transform:[{rotate:'45deg'}],marginTop:-5,
      backgroundColor:focused?'#08795C':colors.isDark?'#0F564A':'#10785B'}}/>
  </View>;
}
function Attribution(){
  const {colors}=useAppTheme();
  return <Pressable accessibilityRole="link"
    onPress={()=>Linking.openURL('https://www.openstreetmap.org/copyright').catch(()=>undefined)}
    style={[styles.attribution,{backgroundColor:colors.isDark?'rgba(4,24,22,.9)':'rgba(255,255,255,.9)'}]}>
    <Text style={{color:colors.muted,fontSize:9,fontWeight:'600'}}>© OpenStreetMap katkıda bulunanlar · ODbL</Text>
  </Pressable>;
}
export default function MosquesScreen(){
  const {colors}=useAppTheme();
  const dark=colors.isDark;
  const mapRef=useRef<MapView>(null),mounted=useRef(true),requestSeq=useRef(0);
  const [mode,setMode]=useState<'map'|'list'>('map');
  const [filter,setFilter]=useState<MosqueFilter>('all'),[query,setQuery]=useState('');
  const [region,setRegion]=useState<Region>(DEFAULT_REGION);
  const [pendingCenter,setPendingCenter]=useState<Coordinate|null>(null);
  const [result,setResult]=useState<MosqueSearchResult|null>(null);
  const [loading,setLoading]=useState(false),[locating,setLocating]=useState(false);
  const [error,setError]=useState<string|null>(null),[hasLocation,setHasLocation]=useState(false);
  const [currentLocation,setCurrentLocation]=useState<Coordinate|null>(null);
  const [selected,setSelected]=useState<MosqueRecord|null>(null),[detail,setDetail]=useState<MosqueRecord|null>(null);
  const {saved,ids,toggle,ready}=useMosqueFavorites();

  const searchArea=useCallback(async(center:Coordinate,force=false)=>{
    const seq=++requestSeq.current;
    setLoading(true);setError(null);
    try{
      const data=await loadMosques(center,{force});
      if(seq!==requestSeq.current||!mounted.current)return;
      setResult(data);setSelected(null);setPendingCenter(null);
    }catch(e){
      if(seq!==requestSeq.current||!mounted.current)return;
      setError(e instanceof Error&&e.message==='MOSQUE_API_NOT_CONFIGURED'
        ?'Cami servisi yayın için yapılandırılmamış. Testte Expo Go geliştirme modunu kullanın.'
        :'Cami kayıtları alınamadı. İnternet bağlantınızı kontrol edip yeniden deneyin.');
    }finally{if(seq===requestSeq.current&&mounted.current)setLoading(false);}
  },[]);
  useEffect(()=>{
    mounted.current=true;
    searchArea(ISTANBUL_CENTER);
    return ()=>{mounted.current=false;requestSeq.current++;};
  },[searchArea]);

  const focus=useCallback((place:MosqueRecord)=>{
    setSelected(place);setMode('map');
    const next:Region={latitude:place.latitude,longitude:place.longitude,
      latitudeDelta:.023,longitudeDelta:.023};
    mapRef.current?.animateToRegion(next,360);
  },[]);
  const locate=useCallback(async()=>{
    setLocating(true);
    try{
      const perm=await Location.requestForegroundPermissionsAsync();
      if(perm.status!=='granted'){
        Alert.alert('Konum izni verilmedi','Haritayı ve camileri konum izni olmadan da kullanabilirsiniz. Dilerseniz haritayı istediğiniz bölgeye taşıyın.');
        return;
      }
      const loc=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
      const center={latitude:loc.coords.latitude,longitude:loc.coords.longitude};
      setHasLocation(true);setCurrentLocation(center);
      mapRef.current?.animateToRegion({...center,latitudeDelta:.06,longitudeDelta:.06},370);
      await searchArea(center);
    }catch{Alert.alert('Konum belirlenemedi','Konum hizmetini açın veya haritayı elle hareket ettirin.');}
    finally{setLocating(false);}
  },[searchArea]);
  const onMove=useCallback((r:Region)=>{
    setRegion(r);
    if(!result)return;
    const point={latitude:r.latitude,longitude:r.longitude};
    const delta=distanceMeters(point,result.center);
    setPendingCenter(delta>800?point:null);
  },[result]);
  const displayed=useMemo(()=>{
    const origin=currentLocation??result?.center??ISTANBUL_CENTER;
    const input=filter==='favorites'
      ?saved.map(x=>({...x,distanceMeters:distanceMeters(origin,x)}))
      :result?.items??[];
    return filterMosques(input,query,filter,ids);
  },[result,filter,query,ids,saved,currentLocation]);
  const visiblePins=useMemo(()=>displayed.slice(0,130),[displayed]);
  const errorMessage=error&&!result?error:null;
  const showRefresh=pendingCenter!==null&&filter!=='favorites';
  const isNear=selected?selected.distanceMeters<20000:false;
  return <SafeAreaView edges={['top']} style={{flex:1,backgroundColor:colors.canvas}}>
    <Atmosphere dark={dark}/>
    <View style={styles.header}>
      <View style={{gap:1,flex:1}}>
        <Text style={{color:colors.gold,letterSpacing:2,fontSize:10,fontWeight:'800'}}>YAKINIMDA · KEŞFET</Text>
        <Text style={{fontFamily:'serif',fontSize:29,fontWeight:'700',color:colors.text,letterSpacing:-.5}}>
          Camiler
        </Text>
      </View>
      <View style={{flexDirection:'row',alignItems:'center',gap:7}}>
        <Pressable accessibilityRole="button" accessibilityLabel="Konumuma git"
          onPress={locate} disabled={locating}
          style={[styles.headerButton,{backgroundColor:colors.surface,borderColor:colors.border}]}>
          {locating?<ActivityIndicator size="small" color={colors.emerald}/>
            :<MaterialCommunityIcons name="crosshairs-gps" size={21} color={colors.emerald}/>}
        </Pressable>
        <View style={[styles.counter,{borderColor:colors.border,backgroundColor:colors.surface}]}>
          <MaterialCommunityIcons name="mosque" size={17} color={colors.gold}/>
          <Text style={{color:colors.text,fontSize:12,fontWeight:'800'}}>{displayed.length}</Text>
        </View>
      </View>
    </View>

    <View style={[styles.search,{borderColor:colors.border,backgroundColor:colors.surface}]}>
      <Feather name="search" size={19} color={colors.gold}/>
      <TextInput value={query} onChangeText={setQuery} autoCorrect={false}
        placeholder="Bu bölgedeki camilerde ara…" placeholderTextColor={colors.muted}
        returnKeyType="search" selectionColor={colors.emerald}
        style={{flex:1,color:colors.text,fontSize:14}}/>
      {query?<Pressable accessibilityRole="button" accessibilityLabel="Aramayı temizle" onPress={()=>setQuery('')}>
        <Feather name="x-circle" color={colors.muted} size={17}/>
      </Pressable>:null}
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
      contentContainerStyle={{paddingHorizontal:14,gap:7,alignItems:'center',paddingVertical:5}}
      style={{flexGrow:0,minHeight:45}}>
      {FILTERS.map(item=><Chip key={item.key} label={item.label} icon={item.icon}
        selected={filter===item.key}
        onPress={()=>{setFilter(item.key);setSelected(null);}}/>)}
    </ScrollView>
    <View style={styles.modeBar}>
      <View style={[styles.segmented,{borderColor:colors.border,backgroundColor:colors.soft}]}>
        {(['map','list'] as const).map(v=><Pressable key={v} onPress={()=>setMode(v)}
          accessibilityRole="button" accessibilityState={{selected:mode===v}}
          style={[styles.segment,{backgroundColor:mode===v?colors.surface:'transparent'}]}>
          <Feather name={v==='map'?'map':'list'} size={15} color={mode===v?colors.emerald:colors.muted}/>
          <Text style={{fontWeight:'700',color:mode===v?colors.text:colors.muted,fontSize:12}}>
            {v==='map'?'Harita':'Liste'}
          </Text>
        </Pressable>)}
      </View>
      <View style={{flex:1,alignItems:'flex-end'}}>
        {result?<Text numberOfLines={1} style={{fontSize:10,color:colors.muted}}>
          {result.source==='stale'?'Çevrimdışı kayıt · ':''}{formatFetchTime(result.fetchedAt)}
        </Text>
          :<Text style={{fontSize:10,color:colors.muted}}>Harita konumu · İstanbul</Text>}
        <Text style={{fontSize:9,color:colors.muted}}>Yarıçap {MOSQUE_RADIUS_METERS/1000} km · OSM verisi</Text>
      </View>
    </View>
    {mode==='map'
      ?<View style={[styles.mapContainer,{borderColor:colors.border}]}>
        <MapView ref={mapRef} style={StyleSheet.absoluteFillObject}
          initialRegion={DEFAULT_REGION}
          showsUserLocation={hasLocation}
          showsMyLocationButton={false} showsCompass
          customMapStyle={dark?[...GOOGLE_NIGHT_STYLE]:undefined}
          onRegionChangeComplete={onMove}
          onPress={()=>setSelected(null)}
          moveOnMarkerPress={false}
          mapType="standard">
          {visiblePins.map(item=><Marker key={item.id}
            coordinate={{latitude:item.latitude,longitude:item.longitude}}
            tracksViewChanges={selected?.id===item.id}
            onPress={()=>setSelected(item)}
            accessibilityLabel={item.name}>
            <MosquePin focused={selected?.id===item.id}/>
          </Marker>)}
        </MapView>
        {showRefresh?<Pressable accessibilityRole="button" disabled={loading}
          onPress={()=>pendingCenter&&searchArea(pendingCenter,true)}
          style={[styles.searchAreaButton,{backgroundColor:colors.isDark?'#134C40':'#FFFFFF',borderColor:colors.gold}]}>
          {loading?<ActivityIndicator size="small" color={colors.emerald}/>
            :<Feather name="refresh-cw" color={colors.emerald} size={15}/>}
          <Text style={{color:colors.text,fontWeight:'800',fontSize:12}}>Bu bölgede ara</Text>
        </Pressable>:null}
        {loading?<View style={[styles.loader,{backgroundColor:colors.surface,borderColor:colors.border}]}>
          <ActivityIndicator size="small" color={colors.emerald}/>
          <Text style={{color:colors.text,fontSize:12,fontWeight:'700'}}>Camiler yükleniyor…</Text>
        </View>:null}
        {error&&!loading?<Pressable accessibilityRole="button" onPress={()=>searchArea(pendingCenter??result?.center??ISTANBUL_CENTER,true)}
          style={[styles.error,{backgroundColor:colors.surface,borderColor:colors.warning}]}>
          <Feather name="alert-circle" color={colors.warning} size={16}/>
          <Text style={{color:colors.text,fontSize:11,flex:1}}>{error}</Text>
          <Feather name="refresh-cw" color={colors.emerald} size={15}/>
        </Pressable>:null}
        {!loading&&!error&&result&&displayed.length===0?<View style={[styles.emptyMap,{backgroundColor:colors.surface,borderColor:colors.border}]}>
          <Feather name="search" size={18} color={colors.gold}/>
          <Text style={{color:colors.text,fontSize:12,flex:1}}>Bu bölgede filtreye uygun cami bulunamadı.</Text>
        </View>:null}
        {selected?<View style={[styles.selectedCard,{backgroundColor:colors.surface,borderColor:colors.border}]}>
          <View style={[styles.miniIcon,{backgroundColor:colors.soft}]}>
            <MosqueCrest width={72} dark={dark}/>
          </View>
          <Pressable style={{flex:1,gap:5}} accessibilityRole="button"
            onPress={()=>setDetail(selected)}>
            <Text numberOfLines={1} style={{color:colors.text,fontSize:16,fontFamily:'serif',fontWeight:'700'}}>
              {selected.name}
            </Text>
            <Text numberOfLines={1} style={{fontSize:11,color:colors.muted}}>
              {selected.address??'Konum haritada kayıtlı'}
            </Text>
            <Text style={{fontSize:11,color:colors.emerald,fontWeight:'800'}}>
              {isNear?formatMosqueDistance(selected.distanceMeters):'Konuma git'} · Detayları gör
            </Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Cami detaylarını aç"
            onPress={()=>setDetail(selected)} style={[styles.openDetail,{backgroundColor:colors.soft}]}>
            <Feather name="arrow-up-right" size={20} color={colors.emerald}/>
          </Pressable>
        </View>:null}
        <Attribution/>
      </View>
      :<View style={{flex:1}}>
        {loading&&!result?<ActivityIndicator size="large" color={colors.emerald} style={{marginTop:70}}/>:null}
        {errorMessage?<Pressable onPress={()=>searchArea(ISTANBUL_CENTER,true)}
          style={{paddingHorizontal:24,paddingTop:30,flexDirection:'row',alignItems:'center',gap:12}}>
          <Feather name="alert-triangle" color={colors.warning} size={22}/>
          <Text style={{color:colors.text,flex:1}}>{errorMessage} · Yeniden dene</Text>
        </Pressable>:null}
        <FlatList data={displayed} keyExtractor={item=>item.id}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
          contentContainerStyle={{paddingHorizontal:14,paddingTop:8,paddingBottom:28,gap:9,flexGrow:1}}
          renderItem={({item})=><MosqueCard place={item}
            favorite={ids.has(item.id)} onFavorite={()=>toggle(item)} onOpen={()=>setDetail(item)}/>}
          ListEmptyComponent={!loading?<View style={{alignItems:'center',paddingTop:45,gap:13}}>
            <MosqueCrest width={160} dark={dark}/>
            <Text style={{fontFamily:'serif',fontSize:19,fontWeight:'700',color:colors.text}}>
              Burada henüz kayıt görünmüyor
            </Text>
            <Text style={{fontSize:12,color:colors.muted,textAlign:'center',lineHeight:20,paddingHorizontal:24}}>
              Haritayı hareket ettirip bu bölgede ara veya başka filtre seç.
            </Text>
          </View>:null}
          ListFooterComponent={<Pressable accessibilityRole="link" onPress={()=>
            Linking.openURL('https://www.openstreetmap.org/copyright').catch(()=>undefined)}
            style={{paddingVertical:13,alignItems:'center'}}>
            <Text style={{fontSize:10,color:colors.muted}}>
              © OpenStreetMap katkıda bulunanlar · ODbL · Kayıtlar eksik olabilir
            </Text>
          </Pressable>}/>
      </View>}
    <MosqueDetail place={detail} isFavorite={detail?ids.has(detail.id):false}
      onFavorite={toggle} onClose={()=>setDetail(null)}/>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  header:{height:82,marginHorizontal:16,flexDirection:'row',alignItems:'center',gap:12},
  headerButton:{height:43,width:43,borderRadius:14,borderWidth:1,alignItems:'center',justifyContent:'center'},
  counter:{height:43,minWidth:62,borderRadius:14,borderWidth:1,paddingHorizontal:10,
    flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6},
  search:{height:49,marginHorizontal:14,marginBottom:4,paddingHorizontal:13,
    borderWidth:1,borderRadius:16,flexDirection:'row',alignItems:'center',gap:10,
    shadowColor:'#42544B',shadowOpacity:.06,shadowRadius:7},
  chip:{minHeight:32,borderRadius:20,borderWidth:1,paddingHorizontal:13,
    flexDirection:'row',alignItems:'center',gap:7},
  modeBar:{height:49,paddingHorizontal:14,alignItems:'center',flexDirection:'row',justifyContent:'space-between',gap:9},
  segmented:{height:36,borderRadius:13,borderWidth:1,padding:3,flexDirection:'row',gap:4},
  segment:{borderRadius:10,paddingHorizontal:11,flexDirection:'row',alignItems:'center',gap:5},
  mapContainer:{flex:1,marginHorizontal:11,marginBottom:8,
    borderRadius:23,borderWidth:1.1,overflow:'hidden',minHeight:240,backgroundColor:'#E3E9E3'},
  searchAreaButton:{position:'absolute',alignSelf:'center',top:15,minHeight:41,
    paddingHorizontal:17,flexDirection:'row',alignItems:'center',
    borderRadius:23,borderWidth:1,gap:8,
    shadowColor:'#34493E',shadowOpacity:.13,shadowRadius:8,elevation:3},
  loader:{position:'absolute',alignSelf:'center',top:65,paddingHorizontal:15,paddingVertical:9,
    flexDirection:'row',alignItems:'center',borderWidth:1,borderRadius:20,gap:9},
  error:{position:'absolute',top:63,left:12,right:12,borderWidth:1,padding:11,
    borderRadius:14,flexDirection:'row',alignItems:'center',gap:7},
  emptyMap:{position:'absolute',top:70,left:16,right:16,padding:13,borderWidth:1,
    borderRadius:14,flexDirection:'row',alignItems:'center',gap:10},
  selectedCard:{position:'absolute',bottom:35,left:9,right:9,minHeight:100,padding:10,
    flexDirection:'row',alignItems:'center',gap:12,borderRadius:20,borderWidth:1,
    shadowColor:'#0A2A22',shadowOpacity:.14,shadowRadius:15,elevation:5},
  miniIcon:{height:75,width:76,borderRadius:14,alignItems:'center',justifyContent:'center'},
  openDetail:{width:37,height:37,borderRadius:12,alignItems:'center',justifyContent:'center'},
  attribution:{position:'absolute',bottom:5,alignSelf:'center',paddingHorizontal:8,
    paddingVertical:3,borderRadius:6},
});
