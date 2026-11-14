import {useEffect,useMemo,useState} from 'react';
import {ActivityIndicator,FlatList,Modal,Pressable,StyleSheet,Text,TextInput,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Feather} from '@expo/vector-icons';
import {useAppTheme} from '@/theme/ThemeProvider';
import {getStates,getCities,configuredPrayerApi,type CityOption,type StateOption,type PrayerPlaceSelection} from './prayerApi';

type Props={
  visible:boolean;
  onClose:()=>void;
  onSelect:(place:PrayerPlaceSelection)=>void;
};
export function LocationPicker({visible,onClose,onSelect}:Props){
  const {colors}=useAppTheme();
  const [state,setState]=useState<StateOption|null>(null);
  const [states,setStates]=useState<StateOption[]>([]);
  const [cities,setCities]=useState<CityOption[]>([]);
  const [filter,setFilter]=useState('');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{
    if(!visible)return;
    let active=true;setLoading(true);setError('');setState(null);setFilter('');
    getStates().then(items=>{if(active)setStates(items);})
      .catch(()=>{if(active)setError('İl listesi alınamadı. İnternet bağlantısını veya takvim kaynağını kontrol et.');})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[visible]);
  const showCities=async(next:StateOption)=>{
    setState(next);setFilter('');setError('');setLoading(true);setCities([]);
    try{setCities(await getCities(next.id));}
    catch{setError('İlçeler alınamadı. Kaynak hizmet geçici olarak yanıt vermiyor olabilir.');}
    finally{setLoading(false);}
  };
  const filtered=useMemo(()=>{
    const text=filter.trim().toLocaleLowerCase('tr-TR');
    const list=state?cities:states;
    return text?list.filter(x=>x.name.toLocaleLowerCase('tr-TR').includes(text)):list;
  },[state,cities,states,filter]);
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <SafeAreaView style={{flex:1,backgroundColor:colors.canvas}} edges={['top','bottom']}>
      <View style={[styles.header,{borderBottomColor:colors.border}]}>
        <Pressable accessibilityRole="button" onPress={()=>state?(setState(null),setFilter('')):onClose()}
          style={[styles.round,{borderColor:colors.border}]}>
          <Feather name={state?'arrow-left':'x'} color={colors.text} size={21}/>
        </Pressable>
        <View style={{alignItems:'center',flex:1}}>
          <Text style={{fontFamily:'serif',fontSize:21,fontWeight:'700',color:colors.text}}>
            {state?state.name:'Konum Seçimi'}
          </Text>
          <Text style={{color:colors.muted,fontSize:11,marginTop:3}}>
            {state?'İlçeni seç':configuredPrayerApi()?'Diyanet resmî il/ilçe rehberi':'İdamedya · üçüncü taraf il/ilçe rehberi'}
          </Text>
        </View>
        <View style={{width:42}}/>
      </View>
      <View style={[styles.search,{backgroundColor:colors.surface,borderColor:colors.border}]}>
        <Feather name="search" size={18} color={colors.gold}/>
        <TextInput value={filter} onChangeText={setFilter}
          style={{flex:1,color:colors.text,fontSize:15}}
          placeholder={state?'İlçe ara':'İl ara'}
          placeholderTextColor={colors.muted} autoCorrect={false}/>
        {filter?<Pressable accessibilityRole="button" onPress={()=>setFilter('')}>
          <Feather name="x" color={colors.muted} size={16}/>
        </Pressable>:null}
      </View>
      {loading?<ActivityIndicator color={colors.emerald} style={{marginTop:45}} size="large"/>:null}
      {error?<View style={{padding:22,gap:12}}>
        <Text style={{color:colors.text,textAlign:'center',lineHeight:21}}>{error}</Text>
        <Pressable onPress={()=>state?showCities(state):(onClose())} style={{alignItems:'center',padding:12}}>
          <Text style={{color:colors.emerald,fontWeight:'700'}}>Tekrar dene / Geri dön</Text>
        </Pressable>
      </View>:null}
      {!loading&&!error?<FlatList data={filtered} keyExtractor={item=>String(item.id)}
        keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingHorizontal:18,paddingBottom:26}}
        ListEmptyComponent={<Text style={{color:colors.muted,textAlign:'center',marginTop:28}}>
          {state?'Bu il için ilçe kaydı yok.':'Sonuç bulunamadı.'}
        </Text>}
        renderItem={({item})=><Pressable accessibilityRole="button"
          onPress={()=>state
            ?onSelect({id:item.id,name:item.name,stateId:state.id,stateName:state.name})
            :showCities(item as StateOption)}
          style={[styles.item,{borderBottomColor:colors.border}]}>
          <View style={[styles.pin,{backgroundColor:colors.soft}]}>
            <Feather name="map-pin" color={colors.emerald} size={17}/>
          </View>
          <Text style={{flex:1,fontSize:15,fontWeight:'600',color:colors.text}}>{item.name}</Text>
          <Feather name="chevron-right" color={colors.muted} size={17}/>
        </Pressable>}/>:null}
    </SafeAreaView>
  </Modal>;
}
const styles=StyleSheet.create({
  header:{height:74,borderBottomWidth:1,flexDirection:'row',alignItems:'center',paddingHorizontal:16,gap:8},
  round:{height:42,width:42,borderWidth:1,borderRadius:14,alignItems:'center',justifyContent:'center'},
  search:{height:49,borderWidth:1,borderRadius:17,margin:18,paddingHorizontal:13,
    flexDirection:'row',alignItems:'center',gap:9},
  item:{minHeight:64,borderBottomWidth:1,flexDirection:'row',alignItems:'center',gap:13},
  pin:{width:35,height:35,borderRadius:12,alignItems:'center',justifyContent:'center'},
});
