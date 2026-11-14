import {useState} from 'react';
import {
  Alert,Linking,Modal,Pressable,ScrollView,StyleSheet,Text,View,
} from 'react-native';
import {Feather,MaterialCommunityIcons} from '@expo/vector-icons';
import {
  DEFAULT_KERAHAT_SETTINGS,KERAHAT_RANGES,KERAHAT_SOURCE_URL,
  formatWindowClock,kerahatWindowLabel,
  type KerahatView,type KerahatSettings,
} from '@camideyiz/core';
import {useAppTheme} from '@/theme/ThemeProvider';

const ENTRIES=[
  {key:'sunriseMinutes',label:'Güneş doğuşundan sonra',icon:'sunrise'},
  {key:'preNoonMinutes',label:'Öğle vaktinden önce',icon:'sun'},
  {key:'preSunsetMinutes',label:'Akşam vaktinden önce',icon:'sunset'},
] as const;
type SettingKey=typeof ENTRIES[number]['key'];

export function KerahatPanel({
  view,settings,update,locationName,
}:{
  view:KerahatView;settings:KerahatSettings;update:(next:KerahatSettings)=>void;
  locationName:string;
}){
  const {colors}=useAppTheme();
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [infoOpen,setInfoOpen]=useState(false);
  const dark=colors.isDark;
  const enabled=settings.mode!=='hidden';
  const current=view.active;
  const soon=view.next;
  const openSource=()=>Linking.openURL(KERAHAT_SOURCE_URL).catch(()=>
    Alert.alert('Kaynak açılamadı','Diyanet bağlantısını daha sonra yeniden deneyin.'));
  const step=(key:SettingKey,amount:number)=>{
    const {min,max}=KERAHAT_RANGES[key];
    const n=Math.max(min,Math.min(max,settings[key]+amount));
    update({...settings,mode:'custom',[key]:n});
  };
  return <View style={[styles.panel,{
    backgroundColor:dark?'rgba(8,52,46,.89)':'rgba(255,252,241,.94)',
    borderColor:current?'#E2AA67':colors.border,
  }]}>
    <View style={styles.top}>
      <View style={[styles.symbol,{backgroundColor:dark?'#56402D':'#F7E4C5'}]}>
        <MaterialCommunityIcons name="weather-sunset" size={21} color={dark?'#F3C385':'#9C6632'}/>
      </View>
      <View style={{flex:1,gap:3}}>
        <Text style={{fontFamily:'serif',color:colors.text,fontSize:17,fontWeight:'700'}}>
          Kerahat Vakitleri
        </Text>
        <Text style={{fontSize:10.5,color:colors.muted,lineHeight:16}}>
          {enabled
            ?settings.mode==='custom'?'Kişisel görüntüleme · yaklaşık aralıklar':'Konuma göre hesaplanan yaklaşık aralıklar'
            :'Çember gösterimi kapalı'} · {locationName}
        </Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Kerahat aralıkları ayarları"
        onPress={()=>setSettingsOpen(true)}
        style={[styles.settings,{borderColor:colors.border,backgroundColor:colors.soft}]}>
        <Feather name="sliders" color={colors.gold} size={17}/>
      </Pressable>
    </View>
    {enabled && view.windows.length ?<>
      <View style={styles.list}>
        {view.windows.map(w=><Pressable key={w.kind} accessibilityRole="button"
          onPress={()=>setInfoOpen(true)}
          style={[styles.window,{borderColor:current?.kind===w.kind?'#DBB477':colors.border,
            backgroundColor:current?.kind===w.kind?(dark?'#4D3731':'#F9EBDC'):colors.soft}]}>
          <View style={[styles.dot,{backgroundColor:current?.kind===w.kind?'#E09B67':'#D5B477'}]}/>
          <Text numberOfLines={1} style={{fontSize:11,color:colors.text,flex:1,fontWeight:'700'}}>
            {kerahatWindowLabel(w.kind)}
          </Text>
          <Text style={{fontSize:11,fontWeight:'800',color:current?.kind===w.kind?colors.gold:colors.text}}>
            {formatWindowClock(w.startSeconds)}–{formatWindowClock(w.endSeconds)}
          </Text>
        </Pressable>)}
      </View>
      <View style={styles.statusRow}>
        <Feather name={current?'alert-circle':soon?'clock':'check-circle'} size={15}
          color={current?'#DEAA68':colors.emerald}/>
        <Text style={{flex:1,color:colors.muted,fontSize:11,lineHeight:17}}>
          {current?'Şu an yaklaşık '+kerahatWindowLabel(current.kind).toLocaleLowerCase('tr-TR')+' aralığı'
            :soon?'Sıradaki yaklaşık aralık: '+kerahatWindowLabel(soon.kind)
              :'Bugün için gösterilen yaklaşık aralıklar tamamlandı'}
        </Text>
      </View>
    </>:<Text style={{color:colors.muted,fontSize:11,lineHeight:18}}>
      {enabled?'Takvim güncel değil; yaklaşık aralıklar gösterilmiyor.':
        'Kerahat vurguları gizlendi. Dilersen ayarlardan yeniden açabilirsin.'}
    </Text>}
    <Pressable accessibilityRole="button" onPress={()=>setInfoOpen(true)}
      style={{flexDirection:'row',alignItems:'center',gap:6,alignSelf:'flex-start'}}>
      <Feather name="info" size={12} color={colors.gold}/>
      <Text style={{color:colors.muted,fontSize:10.5,textDecorationLine:'underline'}}>
        Aralıklar ve namaz türlerine ilişkin önemli bilgi
      </Text>
    </Pressable>

    <Modal visible={settingsOpen} transparent animationType="slide"
      onRequestClose={()=>setSettingsOpen(false)}>
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="Ayar penceresini kapat" accessibilityRole="button"
          style={StyleSheet.absoluteFill} onPress={()=>setSettingsOpen(false)}/>
        <View style={[styles.sheet,{backgroundColor:colors.canvas,borderColor:colors.border}]}>
          <View style={styles.sheetTop}>
            <View style={{flex:1,gap:4}}>
              <Text style={{fontFamily:'serif',fontSize:23,color:colors.text,fontWeight:'700'}}>
                Kerahat ayarları
              </Text>
              <Text style={{fontSize:11,color:colors.muted,lineHeight:18}}>
                İlçeyi değiştirdiğinde aralıklar yeni namaz vakitlerine göre yenilenir.
              </Text>
            </View>
            <Pressable accessibilityLabel="Kapat" onPress={()=>setSettingsOpen(false)}>
              <Feather name="x" size={23} color={colors.text}/>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{gap:12,paddingBottom:8}} showsVerticalScrollIndicator={false}>
            {([
              {mode:'standard',label:'Otomatik · varsayılan',description:'Diyanet açıklamalarındaki yaklaşık sürelerden hareketle.'},
              {mode:'custom',label:'Kişisel görsel aralıklar',description:'Çemberdeki vurgunun süresini değiştir; namaz vakti değişmez.'},
              {mode:'hidden',label:'Çemberde gösterme',description:'Kerahat vurgularını gizle; açıklamaları okuyabilirsin.'},
            ] as const).map(opt=><Pressable key={opt.mode} accessibilityRole="radio"
              accessibilityState={{selected:settings.mode===opt.mode}}
              onPress={()=>update({...settings,mode:opt.mode})}
              style={[styles.option,{borderColor:settings.mode===opt.mode?colors.gold:colors.border,
                backgroundColor:settings.mode===opt.mode?colors.soft:colors.surface}]}>
              <Feather name={settings.mode===opt.mode?'check-circle':'circle'}
                size={19} color={settings.mode===opt.mode?colors.emerald:colors.muted}/>
              <View style={{flex:1,gap:3}}>
                <Text style={{fontSize:13,fontWeight:'800',color:colors.text}}>{opt.label}</Text>
                <Text style={{fontSize:11,lineHeight:17,color:colors.muted}}>{opt.description}</Text>
              </View>
            </Pressable>)}
            {settings.mode==='custom'?<View style={{gap:12,marginTop:7}}>
              {ENTRIES.map(entry=><View key={entry.key} style={[styles.stepper,{
                borderColor:colors.border,backgroundColor:colors.surface}]}>
                <View style={{flex:1,gap:4}}>
                  <Text style={{fontSize:12.5,fontWeight:'700',color:colors.text}}>{entry.label}</Text>
                  <Text style={{fontSize:10,color:colors.muted}}>
                    {KERAHAT_RANGES[entry.key].min}–{KERAHAT_RANGES[entry.key].max} dk aralığında
                  </Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={entry.label+' 1 dakika azalt'}
                  disabled={settings[entry.key]<=KERAHAT_RANGES[entry.key].min}
                  onPress={()=>step(entry.key,-1)} style={[styles.increment,{borderColor:colors.border}]}>
                  <Feather name="minus" size={16} color={colors.gold}/>
                </Pressable>
                <Text style={{minWidth:34,textAlign:'center',fontSize:16,fontWeight:'800',color:colors.text}}>
                  {settings[entry.key]}
                </Text>
                <Pressable accessibilityRole="button" accessibilityLabel={entry.label+' 1 dakika artır'}
                  disabled={settings[entry.key]>=KERAHAT_RANGES[entry.key].max}
                  onPress={()=>step(entry.key,1)} style={[styles.increment,{borderColor:colors.border}]}>
                  <Feather name="plus" size={16} color={colors.gold}/>
                </Pressable>
              </View>)}
              <Pressable onPress={()=>update({...DEFAULT_KERAHAT_SETTINGS,mode:'custom'})}
                style={{alignSelf:'center',padding:9,flexDirection:'row',gap:7}}>
                <Feather name="rotate-ccw" color={colors.emerald} size={14}/>
                <Text style={{fontSize:12,color:colors.emerald,fontWeight:'700'}}>
                  Süreleri varsayılana sıfırla
                </Text>
              </Pressable>
            </View>:null}
            <View style={[styles.notice,{backgroundColor:colors.soft,borderColor:colors.border}]}>
              <Feather name="shield" color={colors.gold} size={18}/>
              <Text style={{flex:1,fontSize:11,lineHeight:18,color:colors.muted}}>
                Bu tercihler yalnızca yaklaşık görselleştirmeyi değiştirir.
                Namaz vakitlerini veya dinî hükümleri değiştirmez.
                Güneşin konumu ve mezhep farklılıkları nedeniyle kesin sınırlar olarak kullanılmamalıdır.
              </Text>
            </View>
            <Pressable onPress={()=>setSettingsOpen(false)} style={[styles.done,{backgroundColor:colors.emerald}]}>
              <Text style={{color:'#FFFFFF',fontWeight:'800'}}>Ayarları uygula</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>

    <Modal visible={infoOpen} transparent animationType="fade"
      onRequestClose={()=>setInfoOpen(false)}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={()=>setInfoOpen(false)}/>
        <View style={[styles.sheet,{backgroundColor:colors.canvas,borderColor:colors.border,gap:14}]}>
          <View style={styles.sheetTop}>
            <Text style={{fontFamily:'serif',fontSize:23,fontWeight:'700',color:colors.text}}>
              Kerahat hakkında
            </Text>
            <Pressable onPress={()=>setInfoOpen(false)} accessibilityLabel="Kapat">
              <Feather name="x" size={22} color={colors.text}/>
            </Pressable>
          </View>
          <Text style={{fontSize:13,lineHeight:21,color:colors.text}}>
            Diyanet Din İşleri Yüksek Kurulu; güneşin doğuşu, tam tepede oluşu
            ve batışı çevresindeki vakitleri açıklar. Gösterilen dakika aralıkları
            mutedil bölgeler için yaklaşık değerlendirmelerdir; kesin fetva veya
            güneş yüksekliği ölçümü değildir.
          </Text>
          <View style={{borderLeftWidth:3,borderLeftColor:colors.gold,paddingLeft:12,gap:6}}>
            <Text style={{fontSize:12.5,lineHeight:19,color:colors.text,fontWeight:'700'}}>
              Tüm namazlar için aynı hüküm geçerli değildir.
            </Text>
            <Text style={{fontSize:11.5,lineHeight:19,color:colors.muted}}>
              Güneş batmadan önceki vakitte o günün ikindi farzı için istisna vardır.
              İmsak sonrası ve ikindi namazı sonrası gibi dönemlerde ise özellikle
              nafile namazlara ilişkin farklı kısıtlamalar bulunur. Mezhep
              farklılıkları da söz konusudur.
            </Text>
          </View>
          <Pressable accessibilityRole="link" onPress={openSource}
            style={[styles.done,{backgroundColor:colors.emerald,flexDirection:'row',gap:9}]}>
            <Feather name="external-link" size={15} color="#FFFFFF"/>
            <Text style={{fontWeight:'800',color:'#FFFFFF'}}>Diyanet açıklamasını aç</Text>
          </Pressable>
          <Pressable onPress={()=>setInfoOpen(false)} style={{alignSelf:'center',padding:6}}>
            <Text style={{color:colors.muted,fontSize:12}}>Kapat</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  </View>;
}
const styles=StyleSheet.create({
  panel:{borderWidth:1,borderRadius:20,padding:14,gap:12,width:'100%'},
  top:{flexDirection:'row',alignItems:'center',gap:11},
  symbol:{width:41,height:41,borderRadius:14,alignItems:'center',justifyContent:'center'},
  settings:{width:38,height:38,borderWidth:1,borderRadius:12,alignItems:'center',justifyContent:'center'},
  list:{gap:7},
  window:{minHeight:35,borderWidth:1,borderRadius:11,paddingHorizontal:10,flexDirection:'row',
    alignItems:'center',gap:7},
  dot:{width:7,height:7,borderRadius:4},
  statusRow:{flexDirection:'row',gap:7,alignItems:'center',paddingHorizontal:3},
  backdrop:{flex:1,backgroundColor:'rgba(0,15,13,.64)',justifyContent:'flex-end'},
  sheet:{borderTopLeftRadius:26,borderTopRightRadius:26,
    borderWidth:1,maxHeight:'87%',paddingHorizontal:19,paddingTop:22,paddingBottom:28},
  sheetTop:{flexDirection:'row',alignItems:'flex-start',gap:10,marginBottom:14},
  option:{borderWidth:1,borderRadius:14,padding:12,flexDirection:'row',alignItems:'center',gap:11},
  stepper:{borderWidth:1,borderRadius:14,padding:12,flexDirection:'row',alignItems:'center',gap:7},
  increment:{width:33,height:33,borderRadius:10,borderWidth:1,alignItems:'center',justifyContent:'center'},
  notice:{borderWidth:1,borderRadius:14,padding:13,flexDirection:'row',alignItems:'flex-start',gap:10},
  done:{height:47,borderRadius:14,alignItems:'center',justifyContent:'center'},
});
