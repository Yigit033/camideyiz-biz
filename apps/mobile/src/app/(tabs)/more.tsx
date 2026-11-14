import {Alert,Linking,Pressable,Share,StyleSheet,Text,View} from 'react-native';
import {Feather} from '@expo/vector-icons';
import {Page,Panel} from '@/components/Page';
import {useAppTheme} from '@/theme/ThemeProvider';
import type {ThemeMode} from '@/theme/tokens';

const modes:{value:ThemeMode;title:string;icon:'sun'|'moon'|'smartphone'}[]=[
  {value:'light',title:'Açık',icon:'sun'},
  {value:'dark',title:'Koyu',icon:'moon'},
  {value:'system',title:'Sistem',icon:'smartphone'},
];
const SOURCES={
  prayer:'https://awqatsalah.diyanet.gov.tr/',
  rules:'https://kurul.diyanet.gov.tr/tr/fetva/mekruh-vakitler-hangileridir-hangi-vakitlerde-kaza-ve-hangi-vakitlerde-nafile-namaz-kilinmaz/0193c42d-52b7-7186-d5b4-f1d3c950ad73',
  quran:'https://kuran.diyanet.gov.tr/',
  hadis:'https://hadislerleislam.diyanet.gov.tr/',
};
function Resource({title,subtitle,icon,onPress}:{
  title:string;subtitle:string;icon:'book-open'|'clock'|'info'|'share-2';onPress:()=>void;
}){
  const {colors}=useAppTheme();
  return <Pressable accessibilityRole="button" onPress={onPress}
    style={[styles.resource,{borderBottomColor:colors.border}]}>
    <View style={[styles.resourceIcon,{backgroundColor:colors.soft}]}>
      <Feather name={icon} size={17} color={colors.gold}/>
    </View>
    <View style={{flex:1,gap:3}}>
      <Text style={{color:colors.text,fontSize:14,fontWeight:'700'}}>{title}</Text>
      <Text style={{color:colors.muted,fontSize:11,lineHeight:17}}>{subtitle}</Text>
    </View>
    <Feather name="arrow-up-right" size={16} color={colors.muted}/>
  </Pressable>;
}
export default function MoreScreen(){
  const {colors,mode,setMode}=useAppTheme();
  const open=async(url:string)=>{
    try{await Linking.openURL(url);}
    catch{Alert.alert('Bağlantı açılamadı','İnternet bağlantını kontrol et.');}
  };
  return <Page title="Menü ve Ayarlar" subtitle="Görünüm ve güvenilir kaynaklara erişim.">
    <Panel>
      <View style={styles.heading}>
        <Feather name="sun" size={19} color={colors.gold}/>
        <Text style={[styles.headingText,{color:colors.text}]}>Görünüm</Text>
      </View>
      <View style={{flexDirection:'row',gap:8}}>
        {modes.map(item=><Pressable key={item.value} onPress={()=>setMode(item.value)}
          accessibilityRole="button" accessibilityState={{selected:mode===item.value}}
          style={[styles.mode,{
            borderColor:mode===item.value?colors.gold:colors.border,
            backgroundColor:mode===item.value?colors.soft:colors.canvas,
          }]}>
          <Feather name={item.icon} color={colors.text} size={19}/>
          <Text style={{color:colors.text,fontSize:12,fontWeight:'700'}}>{item.title}</Text>
        </Pressable>)}
      </View>
    </Panel>
    <Panel>
      <View style={styles.heading}>
        <Feather name="shield" size={19} color={colors.gold}/>
        <Text style={[styles.headingText,{color:colors.text}]}>Kaynaklar ve doğruluk</Text>
      </View>
      <View style={{borderRadius:14,backgroundColor:colors.soft,padding:14,gap:7}}>
        <Text style={{fontSize:13,color:colors.text,fontWeight:'700'}}>Ücretsiz namaz vakitleri kaynağı</Text>
        <Text style={{fontSize:12,lineHeight:19,color:colors.muted}}>
          İdamedya, Diyanet tarafından yayımlandığını belirttiği namaz vakitlerini ücretsiz aktarıyor. Bu bağımsız servis, Diyanet'in resmî API'si değildir. Güncel veri doğrulanırsa ekranda gösterilir; resmî Diyanet API entegrasyonumuz ayrı olarak hazır tutuluyor.
        </Text>
      </View>
      <Resource title="Diyanet Namaz Vakti Servisi" subtitle="Resmî API ve başvuru bilgileri"
        icon="clock" onPress={()=>open(SOURCES.prayer)}/>
      <Resource title="Kerahet vakitleri" subtitle="Din İşleri Yüksek Kurulunun açıklamaları"
        icon="info" onPress={()=>open(SOURCES.rules)}/>
      <Resource title="Kur’an ve hadis kaynakları" subtitle="Diyanet'in içerik ve kaynak sayfaları"
        icon="book-open" onPress={()=>open(SOURCES.quran)}/>
    </Panel>
    <Panel>
      <View style={styles.heading}>
        <Feather name="info" size={19} color={colors.gold}/>
        <Text style={[styles.headingText,{color:colors.text}]}>Uygulama hakkında</Text>
      </View>
      <Text style={{fontSize:12,lineHeight:20,color:colors.muted}}>
        Camideyiz Biz · iOS ve Android için namaz vakitleri, kıble ve kaynaklı içerik deneyimi.
      </Text>
      <Pressable accessibilityRole="button" style={[styles.share,{backgroundColor:colors.soft}]}
        onPress={()=>Share.share({message:'Camideyiz Biz — namaz vakitleri ve içerik deneyimi.'}).catch(()=>undefined)}>
        <Feather name="share-2" color={colors.emerald} size={16}/>
        <Text style={{color:colors.text,fontWeight:'700',fontSize:13}}>Uygulamayı paylaş</Text>
      </Pressable>
    </Panel>
    <Text style={{color:colors.muted,textAlign:'center',fontSize:11}}>
      Camideyiz Biz · Sürüm 0.1.0
    </Text>
  </Page>;
}
const styles=StyleSheet.create({
  heading:{flexDirection:'row',alignItems:'center',gap:10},
  headingText:{fontSize:17,fontWeight:'700',fontFamily:'serif'},
  mode:{flex:1,minHeight:68,alignItems:'center',justifyContent:'center',gap:6,borderRadius:14,borderWidth:1.3},
  resource:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:14,borderBottomWidth:1},
  resourceIcon:{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center'},
  share:{minHeight:47,borderRadius:13,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:8},
});
