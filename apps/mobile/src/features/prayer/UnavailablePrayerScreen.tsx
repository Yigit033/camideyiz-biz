import {Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {useState} from 'react';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Feather} from '@expo/vector-icons';
import {useAppTheme} from '@/theme/ThemeProvider';
import {Atmosphere,MosqueCrest} from '@/components/LuxuryArtwork';
import {LocationPicker} from './LocationPicker';
import {usePrayerSource} from './usePrayerSource';

type Props={official:ReturnType<typeof usePrayerSource>};
export function UnavailablePrayerScreen({official}:Props){
  const {colors}=useAppTheme();
  const [pickerOpen,setPickerOpen]=useState(false);
  const problem=official.status==='unconfigured'
    ? 'Güvenli takvim sunucusu henüz yapılandırılmadı.'
    :official.status==='choose-location'
      ? 'Resmî vakitleri görmek için il ve ilçeni seç.'
      :official.status==='loading'
        ? 'Diyanet namaz vakitleri kontrol ediliyor…'
        : 'Seçilen ilçe için doğrulanmış namaz vakitleri henüz alınamadı.';
  return <SafeAreaView edges={['top']} style={{flex:1,backgroundColor:colors.canvas}}>
    <Atmosphere dark={colors.isDark}/>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.brand,{color:colors.text}]}>Camideyiz Biz</Text>
      <Text style={[styles.eyebrow,{color:colors.gold}]}>NAMAZ VAKİTLERİ · TÜRKİYE</Text>
      <View style={[styles.panel,{backgroundColor:colors.surface,borderColor:colors.border}]}>
        <MosqueCrest width={212} dark={colors.isDark}/>
        <Text style={[styles.title,{color:colors.text}]}>Vakit Takvimi</Text>
        <Text style={[styles.message,{color:colors.muted}]}>{problem}</Text>
        <Text style={[styles.explanation,{color:colors.muted}]}>
          Yalnızca kaynağı ve tarihi doğrulanmış namaz saatleri gösterilir. Örnek vakitler gerçekmiş gibi sunulmaz.
        </Text>
      </View>
      {official.place?<Text style={{color:colors.muted,fontSize:12,textAlign:'center'}}>
        Seçili konum: {official.place.stateName} / {official.place.name}
      </Text>:null}
      <Pressable accessibilityRole="button" disabled={!official.configured}
        onPress={()=>setPickerOpen(true)}
        style={[styles.button,{backgroundColor:official.configured?colors.emerald:colors.soft}]}>
        <Feather name="map-pin" size={19} color={official.configured?'#FFFFFF':colors.muted}/>
        <Text style={{color:official.configured?'#FFFFFF':colors.muted,fontSize:14,fontWeight:'800'}}>
          {official.place?'İlçeyi değiştir':'İl ve İlçe Seç'}
        </Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={official.retry}
        style={{flexDirection:'row',alignItems:'center',justifyContent:'center',padding:16,gap:9}}>
        <Feather name="refresh-cw" size={16} color={colors.gold}/>
        <Text style={{color:colors.text,fontWeight:'700'}}>Yeniden kontrol et</Text>
      </Pressable>
      <Text style={{fontSize:11,color:colors.muted,textAlign:'center',lineHeight:19}}>
        Kaynak: Diyanet Awqat Salah. Bağlantı veya veri eksikliği varsa güvenilir saatler gelene kadar takvim boş kalır.
      </Text>
    </ScrollView>
    <LocationPicker visible={pickerOpen} onClose={()=>setPickerOpen(false)}
      onSelect={p=>{official.selectPlace(p).catch(()=>undefined);setPickerOpen(false);}}/>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  content:{padding:22,paddingTop:30,alignItems:'center',gap:14,paddingBottom:60},
  brand:{fontFamily:'serif',fontWeight:'700',fontSize:30,marginTop:9},
  eyebrow:{fontSize:10,fontWeight:'800',letterSpacing:1.8,marginBottom:25},
  panel:{width:'100%',alignItems:'center',borderWidth:1,borderRadius:29,
    paddingHorizontal:25,paddingVertical:32,gap:12,
    shadowColor:'#947A53',shadowOpacity:.07,shadowRadius:18},
  title:{fontFamily:'serif',fontSize:27,fontWeight:'700',marginTop:9},
  message:{textAlign:'center',fontSize:14,lineHeight:23},
  explanation:{textAlign:'center',fontSize:11,lineHeight:18,marginTop:5},
  button:{width:'100%',height:54,borderRadius:16,flexDirection:'row',
    alignItems:'center',justifyContent:'center',gap:10,marginTop:14},
});
