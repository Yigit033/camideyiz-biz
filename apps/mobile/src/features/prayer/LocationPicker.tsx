import {useEffect,useMemo,useRef,useState} from 'react';
import {
  ActivityIndicator,FlatList,Modal,Pressable,StyleSheet,Text,TextInput,View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Feather} from '@expo/vector-icons';
import {useAppTheme} from '@/theme/ThemeProvider';
import {
  getStates,getCities,
  type CityOption,type StateOption,type PrayerPlaceSelection,
} from './prayerApi';

type Props={
  visible:boolean;onClose:()=>void;
  onSelect:(place:PrayerPlaceSelection)=>Promise<void>|void;
};
const CACHE_PREFIX='@camideyiz/place-directory/v3/';
const MAX_CACHE_AGE_MS=7*86400_000;
function prettyName(name:string):string{
  return name.toLocaleLowerCase('tr-TR')
    .replace(/(^|[\s\-])\S/g,match=>match.toLocaleUpperCase('tr-TR'));
}
function parseCached<T extends {id:number;name:string}>(raw:string|null):T[]|null{
  if(!raw)return null;
  try{
    const value:unknown=JSON.parse(raw);
    if(!value||typeof value!=='object')return null;
    const obj=value as {savedAt?:unknown;items?:unknown};
    if(typeof obj.savedAt!=='number'||obj.savedAt>Date.now()+60_000||
      Date.now()-obj.savedAt>MAX_CACHE_AGE_MS||
      !Array.isArray(obj.items)||obj.items.length===0||obj.items.length>300)return null;
    if(!obj.items.every((v:unknown)=>v&&typeof v==='object'&&
      Number.isSafeInteger((v as {id?:number}).id)&&
      (v as {id:number}).id>0&&
      typeof (v as {name?:unknown}).name==='string'&&
      (v as {name:string}).name.length>1))return null;
    return obj.items as T[];
  }catch{return null;}
}
async function cached<T extends {id:number;name:string}>(key:string):Promise<T[]|null>{
  try{return parseCached<T>(await AsyncStorage.getItem(CACHE_PREFIX+key));}
  catch{return null;}
}
function store<T extends {id:number;name:string}>(key:string,items:T[]):void{
  AsyncStorage.setItem(CACHE_PREFIX+key,JSON.stringify({
    savedAt:Date.now(),items,
  })).catch(()=>undefined);
}

/** Two explicit steps: 1 province, 2 district. A provider directory outage
 * must not silently convert a province click into a province prayer selection.
 */
export function LocationPicker({visible,onClose,onSelect}:Props){
  const {colors}=useAppTheme();
  const [province,setProvince]=useState<StateOption|null>(null);
  const [states,setStates]=useState<StateOption[]>([]);
  const [districts,setDistricts]=useState<CityOption[]>([]);
  const [filter,setFilter]=useState('');
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [offline,setOffline]=useState(false);
  const requestId=useRef(0);

  const loadProvinces=async()=>{
    const request=++requestId.current;
    setLoading(true);setError('');setOffline(false);
    try{
      const items=await getStates();
      if(request!==requestId.current)return;
      if(items.length===0)throw new Error('Empty province list');
      setStates(items);
      store('states',items);
    }catch{
      const saved=await cached<StateOption>('states');
      if(request!==requestId.current)return;
      if(saved?.length){
        setStates(saved);setOffline(true);
      }else setError('İl listesi alınamadı. İnternet bağlantını kontrol edip yeniden dene.');
    }finally{if(request===requestId.current)setLoading(false);}
  };
  useEffect(()=>{
    if(!visible){requestId.current++;return;}
    setProvince(null);setDistricts([]);setFilter('');setError('');setSaving(false);
    void loadProvinces();
    return ()=>{requestId.current++;};
  },[visible]);

  const loadDistricts=async(next:StateOption)=>{
    const request=++requestId.current;
    setProvince(next);setFilter('');setError('');setLoading(true);
    setOffline(false);setDistricts([]);
    try{
      const items=await getCities(next.id);
      if(request!==requestId.current)return;
      if(items.length===0)throw new Error('Empty district list');
      setDistricts(items);
      store('cities/'+next.id,items);
    }catch{
      const saved=await cached<CityOption>('cities/'+next.id);
      if(request!==requestId.current)return;
      const valid=saved?.filter(x=>x.state_id===next.id);
      if(valid?.length){setDistricts(valid);setOffline(true);}
      else setError('Bu ilin ilçe rehberine ulaşılamadı. Tekrar dene veya başka bir bağlantı kullan.');
    }finally{if(request===requestId.current)setLoading(false);}
  };
  const back=()=>{
    if(saving)return;
    if(province){
      requestId.current++;
      setProvince(null);setDistricts([]);setFilter('');setError('');
      setOffline(false);setLoading(false);
    }else onClose();
  };
  const select=async(item:CityOption)=>{
    if(!province||saving||loading)return;
    if(item.state_id!==province.id)return;
    setSaving(true);setError('');
    try{
      await onSelect({
        id:item.id,name:prettyName(item.name),
        stateId:province.id,stateName:prettyName(province.name),
      });
      // Parent closes picker only after AsyncStorage has saved the district.
    }catch(error){
      setError(error instanceof Error?error.message:
        'İlçe seçimi kaydedilemedi. Yeniden dene.');
    }finally{setSaving(false);}
  };
  const filtered=useMemo(()=>{
    const query=filter.trim().toLocaleLowerCase('tr-TR');
    const items=province?districts:states;
    return query?items.filter(x=>x.name.toLocaleLowerCase('tr-TR').includes(query)):items;
  },[province,states,districts,filter]);

  return <Modal visible={visible} animationType="slide"
    presentationStyle="pageSheet" onRequestClose={back}>
    <SafeAreaView edges={['top','bottom']}
      style={{flex:1,backgroundColor:colors.canvas}}>
      <View style={[styles.header,{borderBottomColor:colors.border}]}>
        <Pressable accessibilityRole="button" accessibilityLabel={province?'İl listesine dön':'Kapat'}
          disabled={saving} onPress={back}
          style={[styles.round,{borderColor:colors.border}]}>
          <Feather name={province?'arrow-left':'x'} size={21} color={colors.text}/>
        </Pressable>
        <View style={{flex:1,alignItems:'center',gap:4}}>
          <Text style={{fontFamily:'serif',fontWeight:'800',fontSize:21,color:colors.text}}>
            {province?prettyName(province.name):'Konum Seç'}
          </Text>
          <Text style={{fontSize:11,color:colors.muted}}>
            {province?'2 / 2 · İlçeni seç':'1 / 2 · Önce ilini seç'}
          </Text>
        </View>
        <View style={{width:42}}/>
      </View>
      <View style={styles.steps}>
        <View style={[styles.step,{backgroundColor:province?colors.soft:colors.accentStrong}]}>
          <Text style={{fontSize:11,fontWeight:'800',color:province?colors.text:'#FFF'}}>1 · İl</Text>
        </View>
        <Feather name="chevron-right" size={15} color={colors.muted}/>
        <View style={[styles.step,{backgroundColor:province?colors.accentStrong:colors.soft}]}>
          <Text style={{fontSize:11,fontWeight:'800',color:province?'#FFF':colors.muted}}>2 · İlçe</Text>
        </View>
      </View>
      <View style={[styles.search,{backgroundColor:colors.surface,borderColor:colors.border}]}>
        <Feather name="search" size={18} color={colors.gold}/>
        <TextInput value={filter} onChangeText={setFilter}
          editable={!loading&&!saving}
          style={{flex:1,color:colors.text,fontSize:15}}
          placeholder={province?'İlçe ara · ör. Pendik, Tuzla':'İl ara · ör. İstanbul'}
          placeholderTextColor={colors.muted} autoCorrect={false}/>
        {filter?<Pressable accessibilityRole="button" onPress={()=>setFilter('')}>
          <Feather name="x" color={colors.muted} size={16}/>
        </Pressable>:null}
      </View>
      {offline?<View style={[styles.hint,{backgroundColor:colors.soft}]}>
        <Feather name="wifi-off" size={15} color={colors.gold}/>
        <Text style={{flex:1,color:colors.muted,fontSize:11,lineHeight:17}}>
          Kaydedilmiş il/ilçe listesini gösteriyoruz. Saatler ayrıca doğrulanacaktır.
        </Text>
      </View>:null}
      {province?<Text style={{fontSize:11,color:colors.muted,paddingHorizontal:19,marginBottom:8}}>
        {prettyName(province.name)} için namaz takvimi bölgesi seç.
        Seçtiğin ilçe, ana ekrana ve widget'lara yansıyacak.
      </Text>:null}
      {(loading||saving)?<View style={{alignItems:'center',marginTop:24,gap:9}}>
        <ActivityIndicator color={colors.emerald} size="large"/>
        <Text style={{color:colors.muted,fontSize:12}}>
          {saving?'İlçe tercihi kaydediliyor…':'Takvim bölgeleri yükleniyor…'}
        </Text>
      </View>:null}
      {error?<View style={{paddingHorizontal:22,gap:11,marginTop:12}}>
        <View style={[styles.hint,{backgroundColor:colors.soft}]}>
          <Feather name="alert-circle" size={18} color={colors.gold}/>
          <Text style={{flex:1,color:colors.text,fontSize:12,lineHeight:19}}>{error}</Text>
        </View>
        <Pressable accessibilityRole="button" disabled={saving}
          onPress={()=>province?void loadDistricts(province):void loadProvinces()}
          style={[styles.retry,{backgroundColor:colors.accentStrong}]}>
          <Feather name="refresh-cw" color="#FFF" size={16}/>
          <Text style={{color:'#FFF',fontWeight:'800'}}>Tekrar dene</Text>
        </Pressable>
      </View>:null}
      {!loading&&!saving&&!error?<FlatList data={filtered}
        keyExtractor={item=>String(item.id)} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{paddingHorizontal:18,paddingBottom:45}}
        ListEmptyComponent={<Text style={{color:colors.muted,textAlign:'center',marginTop:28}}>
          {province?'Bu il için eşleşen ilçe bulunamadı.':'Sonuç bulunamadı.'}
        </Text>}
        renderItem={({item})=><Pressable accessibilityRole="button"
          accessibilityLabel={prettyName(item.name)+(province?' ilçesini seç':' ilini seç')}
          onPress={()=>province
            ?void select(item as CityOption)
            :void loadDistricts(item as StateOption)}
          style={[styles.item,{borderBottomColor:colors.border}]}>
          <View style={[styles.pin,{backgroundColor:colors.soft}]}>
            <Feather name={province?'navigation':'map-pin'} color={colors.emerald} size={17}/>
          </View>
          <View style={{flex:1,gap:3}}>
            <Text style={{fontSize:15,fontWeight:'700',color:colors.text}}>
              {prettyName(item.name)}
            </Text>
            {province?<Text style={{color:colors.muted,fontSize:10}}>
              Bu ilçenin yayımlanan namaz takvimini kullan
            </Text>:null}
          </View>
          <Feather name={province?'check-circle':'chevron-right'} size={17}
            color={province?colors.emerald:colors.muted}/>
        </Pressable>}/>:null}
    </SafeAreaView>
  </Modal>;
}
const styles=StyleSheet.create({
  header:{height:70,borderBottomWidth:1,flexDirection:'row',alignItems:'center',
    paddingHorizontal:15,gap:8},
  round:{width:42,height:42,borderWidth:1,borderRadius:14,alignItems:'center',justifyContent:'center'},
  steps:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:12,
    paddingTop:13,paddingBottom:3},
  step:{minWidth:75,height:26,borderRadius:13,alignItems:'center',justifyContent:'center',
    paddingHorizontal:9},
  search:{height:49,borderWidth:1,borderRadius:17,margin:17,paddingHorizontal:13,
    flexDirection:'row',alignItems:'center',gap:9},
  hint:{borderRadius:14,padding:12,flexDirection:'row',alignItems:'center',
    gap:10,marginHorizontal:19,marginBottom:12},
  item:{minHeight:66,borderBottomWidth:1,flexDirection:'row',alignItems:'center',gap:12},
  pin:{width:38,height:38,borderRadius:13,alignItems:'center',justifyContent:'center'},
  retry:{minHeight:43,borderRadius:13,alignItems:'center',justifyContent:'center',
    flexDirection:'row',gap:8},
});
