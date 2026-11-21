import {Alert,Linking,Pressable,StyleSheet,Switch,Text,View} from 'react-native';
import {router} from 'expo-router';
import {Feather,MaterialCommunityIcons} from '@expo/vector-icons';
import {Page,Panel} from '@/components/Page';
import {useAppTheme} from '@/theme/ThemeProvider';
import {useKerahatSettings} from '@/features/prayer/KerahatSettingsProvider';
import {
  DEFAULT_KERAHAT_SETTINGS,KERAHAT_RANGES,KERAHAT_SOURCE_URL,type KerahatSettings,
} from '@camideyiz/core';

type SettingKey='sunriseMinutes'|'preNoonMinutes'|'preSunsetMinutes';
const ROWS:{key:SettingKey;title:string;note:string;icon:'sunrise'|'sun'|'sunset'}[]=[
  {key:'sunriseMinutes',title:'Güneş doğuşu sonrası',note:'İç halkada gösterilen yaklaşık süre',icon:'sunrise'},
  {key:'preNoonMinutes',title:'Zeval · öğle öncesi',note:'Öğle öncesindeki yaklaşık süre',icon:'sun'},
  {key:'preSunsetMinutes',title:'Güneş batışı öncesi',note:'Akşam öncesindeki yaklaşık süre',icon:'sunset'},
];

export default function KerahatSettingsScreen(){
  const {colors}=useAppTheme();
  const {settings,update,ready}=useKerahatSettings();
  const enabled=settings.mode!=='hidden';
  const toggle=(value:boolean)=>update({...settings,mode:value?'custom':'hidden'});
  const isAtDefault=['sunriseMinutes','preNoonMinutes','preSunsetMinutes'].every(
    key=>settings[key as SettingKey]===DEFAULT_KERAHAT_SETTINGS[key as SettingKey],
  );
  const resetToDefault=()=>update({...DEFAULT_KERAHAT_SETTINGS,mode:'custom'});
  const step=(key:SettingKey,delta:number)=>{
    const {min,max}=KERAHAT_RANGES[key];
    const value=Math.max(min,Math.min(max,settings[key]+delta));
    update({...settings,mode:'custom',[key]:value} as KerahatSettings);
  };
  const openSource=()=>void Linking.openURL(KERAHAT_SOURCE_URL)
    .catch(()=>Alert.alert('Bağlantı açılamadı','İnternet bağlantını kontrol et.'));

  return <Page title="Kerahet Vakitleri"
    subtitle="İç halka görünümünü ve yaklaşık aralıkları yönet. Namaz vakitleri değişmez.">
    <Pressable onPress={()=>router.back()} accessibilityRole="button"
      accessibilityLabel="Ayarlar sayfasına dön"
      style={{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:7,paddingVertical:4}}>
      <Feather name="arrow-left" size={17} color={colors.emerald}/>
      <Text style={{color:colors.emerald,fontSize:13,fontWeight:'700'}}>Ayarlara dön</Text>
    </Pressable>
    <Panel>
      <View style={styles.heading}>
        <View style={[styles.headerIcon,{backgroundColor:colors.soft}]}>
          <MaterialCommunityIcons name="weather-sunset" color={colors.gold} size={23}/>
        </View>
        <View style={{flex:1,gap:4}}>
          <Text style={{fontSize:17,fontFamily:'serif',color:colors.text,fontWeight:'700'}}>
            Çemberde kerahet halkası
          </Text>
          <Text style={{fontSize:11,lineHeight:17,color:colors.muted}}>
            Üç aralığı ana namaz çemberinin iç tarafında ayrı bir halkayla gösterir.
          </Text>
        </View>
        <Switch value={enabled} onValueChange={toggle} disabled={!ready}
          accessibilityLabel="Kerahet halkasını göster"
          trackColor={{false:colors.border,true:colors.emerald}}
          thumbColor="#FFF8E9"/>
      </View>
    </Panel>
    {enabled?<Panel>
      <Text style={{fontSize:17,fontWeight:'700',fontFamily:'serif',color:colors.text}}>
        Görsel aralık süreleri
      </Text>
      <Text style={{fontSize:11,color:colors.muted,lineHeight:18}}>
        Türkiye için uygulama başlangıç profili: 45 / 30 / 45 dk. Bu değerler
        kişiselleştirilebilir görsel uyarı süreleridir; resmî dinî hüküm veya
        Diyanet tarafından yayımlanan sabit kerahet süresi değildir.
        Namaz vakitleri değiştirilmez.
      </Text>
      <Pressable accessibilityRole="button"
        accessibilityLabel="Kerahet uyarı sürelerini 45, 30 ve 45 dakikaya döndür"
        disabled={!ready||isAtDefault}
        onPress={resetToDefault}
        style={[styles.resetButton,{
          borderColor:colors.border,backgroundColor:colors.soft,
          opacity:!ready||isAtDefault?.5:1,
        }]}>
        <Feather name="rotate-ccw" size={14} color={colors.emerald}/>
        <Text style={{color:colors.emerald,fontSize:11.5,fontWeight:'800'}}>
          45 · 30 · 45 dk varsayılana dön
        </Text>
      </Pressable>
      {ROWS.map(row=>{
        const range=KERAHAT_RANGES[row.key];
        const value=settings[row.key];
        return <View key={row.key} style={[styles.timeRow,{
          borderColor:colors.border,backgroundColor:colors.soft}]}>
          <View style={[styles.timeIcon,{backgroundColor:colors.surface}]}>
            <Feather name={row.icon} size={18} color={colors.gold}/>
          </View>
          <View style={{flex:1,gap:4}}>
            <Text style={{fontSize:12.5,fontWeight:'700',color:colors.text}}>
              {row.title}
            </Text>
            <Text style={{fontSize:10,color:colors.muted,lineHeight:16}}>
              {row.note} · {range.min}–{range.max} dk
            </Text>
          </View>
          <View style={styles.adjust}>
            <Pressable accessibilityRole="button"
              accessibilityLabel={row.title+' süresini bir dakika azalt'}
              onPress={()=>step(row.key,-1)} disabled={value<=range.min}
              style={[styles.adjustButton,{borderColor:colors.border,
                opacity:value<=range.min?.35:1}]}>
              <Feather name="minus" size={15} color={colors.gold}/>
            </Pressable>
            <Text style={{minWidth:37,textAlign:'center',fontSize:14,
              fontWeight:'800',color:colors.text}}>{value} dk</Text>
            <Pressable accessibilityRole="button"
              accessibilityLabel={row.title+' süresini bir dakika artır'}
              onPress={()=>step(row.key,1)} disabled={value>=range.max}
              style={[styles.adjustButton,{borderColor:colors.border,
                opacity:value>=range.max?.35:1}]}>
              <Feather name="plus" size={15} color={colors.gold}/>
            </Pressable>
          </View>
        </View>;
      })}
    </Panel>:null}
    <Panel>
      <View style={{flexDirection:'row',gap:10,alignItems:'flex-start'}}>
        <Feather name="shield" size={19} color={colors.gold}/>
        <View style={{flex:1,gap:9}}>
          <Text style={{fontSize:14,fontWeight:'700',color:colors.text}}>
            Kaynak ve dinî doğruluk
          </Text>
          <Text style={{fontSize:11.5,color:colors.muted,lineHeight:19}}>
            Kerahet aralıkları güneş konumunun kesin ölçümü değildir; yayımlanmış
            namaz saatlerinden türetilmiş, kişiselleştirilebilir yaklaşık
            görselleştirmelerdir. Farz ve nafile namazlarla ilgili hükümler aynı
            olmayabilir; mezhep farklılıklarını dikkate al.
          </Text>
        </View>
      </View>
      <Pressable onPress={openSource} accessibilityRole="link"
        style={[styles.sourceLink,{borderColor:colors.border}]}>
        <Feather name="external-link" size={16} color={colors.emerald}/>
        <Text style={{fontSize:12,color:colors.emerald,fontWeight:'800'}}>
          Diyanet açıklamasını aç
        </Text>
      </Pressable>
    </Panel>
  </Page>;
}
const styles=StyleSheet.create({
  heading:{flexDirection:'row',alignItems:'center',gap:10},
  headerIcon:{width:45,height:45,borderRadius:15,alignItems:'center',justifyContent:'center'},
  timeRow:{borderWidth:1,borderRadius:15,padding:10,flexDirection:'row',
    alignItems:'center',gap:9},
  timeIcon:{height:34,width:34,borderRadius:11,alignItems:'center',justifyContent:'center'},
  resetButton:{flexDirection:'row',alignItems:'center',justifyContent:'center',
    alignSelf:'flex-start',gap:8,paddingHorizontal:12,paddingVertical:9,
    borderRadius:12,borderWidth:1},
  adjust:{alignItems:'center',gap:4},
  adjustButton:{height:27,width:30,alignItems:'center',justifyContent:'center',
    borderWidth:1,borderRadius:9},
  sourceLink:{height:42,borderWidth:1,borderRadius:13,flexDirection:'row',
    gap:8,alignItems:'center',justifyContent:'center'},
});
