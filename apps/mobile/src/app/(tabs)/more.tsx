import {Pressable,Text,View} from 'react-native';
import {Feather} from '@expo/vector-icons';
import {Page,Panel} from '@/components/Page';
import {useAppTheme} from '@/theme/ThemeProvider';
import type {ThemeMode} from '@/theme/tokens';
const modes:{value:ThemeMode;title:string;icon:'sun'|'moon'|'smartphone'}[]=[
  {value:'light',title:'Açık',icon:'sun'},
  {value:'dark',title:'Koyu',icon:'moon'},
  {value:'system',title:'Sistem',icon:'smartphone'}
];
const planned=[
  {title:'Konumlar',detail:'Favori şehirler ve yatay geçiş'},
  {title:'Uyarılar',detail:'Namaz bazında ön hatırlatma ve ezan sesleri'},
  {title:'Bildirim geçmişi',detail:'Uygulama içi geçmiş ve okundu durumu'},
  {title:'Kerahet ve İlmihal',detail:'Doğrulanmış dini bilgiler'},
  {title:'Sehiv Secdesi',detail:'İçerikler hazır olduğunda açılacak'},
  {title:'Hac ve Umre',detail:'Mekke/Medine vakitleri ve dualar'}
];
export default function MoreScreen(){
  const {colors,mode,setMode}=useAppTheme();
  return <Page title="Menü ve Ayarlar" subtitle="Camideyiz Biz'i kendi kullanımına göre düzenle.">
    <Panel>
      <Text style={{fontWeight:'700',fontSize:17,color:colors.text}}>Görünüm</Text>
      <View style={{flexDirection:'row',gap:8}}>
        {modes.map(item=><Pressable key={item.value} onPress={()=>setMode(item.value)}
          accessibilityRole="button" accessibilityState={{selected:mode===item.value}}
          style={{flex:1,minHeight:64,alignItems:'center',justifyContent:'center',gap:6,borderRadius:13,borderColor:mode===item.value?colors.gold:colors.border,borderWidth:1.5,backgroundColor:mode===item.value?colors.soft:colors.canvas}}>
          <Feather name={item.icon} color={colors.text} size={19}/>
          <Text style={{color:colors.text,fontSize:12,fontWeight:'700'}}>{item.title}</Text>
        </Pressable>)}
      </View>
    </Panel>
    <Panel>
      <Text style={{fontWeight:'700',fontSize:17,color:colors.text,marginBottom:3}}>Yakında gelecek</Text>
      {planned.map((item,index)=><View key={item.title} style={{paddingVertical:10,borderBottomWidth:index===planned.length-1?0:1,borderBottomColor:colors.border}}>
        <Text style={{color:colors.text,fontWeight:'600',fontSize:14}}>{item.title}</Text>
        <Text style={{color:colors.muted,fontSize:12,marginTop:5}}>{item.detail}</Text>
      </View>)}
    </Panel>
    <Text style={{fontSize:12,color:colors.muted,textAlign:'center'}}>Camideyiz Biz · Tasarım prototipi v0.1</Text>
  </Page>;
}
