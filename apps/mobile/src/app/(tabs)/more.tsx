import {Pressable,Share,StyleSheet,Text,View} from 'react-native';
import {Feather,MaterialCommunityIcons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {Page,Panel} from '@/components/Page';
import {useAppTheme} from '@/theme/ThemeProvider';
import type {ThemeMode} from '@/theme/tokens';

const modes:{value:ThemeMode;title:string;icon:'sun'|'moon'|'smartphone'}[]=[
  {value:'light',title:'Açık',icon:'sun'},
  {value:'dark',title:'Koyu',icon:'moon'},
  {value:'system',title:'Sistem',icon:'smartphone'},
];
export default function MoreScreen(){
  const {colors,mode,setMode}=useAppTheme();
  return <Page title="Menü ve Ayarlar" subtitle="Görünüm, namaz vakitleri ve bildirimler.">
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
        <Feather name="clock" size={19} color={colors.gold}/>
        <Text style={[styles.headingText,{color:colors.text}]}>Namaz Takvimi Ayarları</Text>
      </View>
      <Pressable accessibilityRole="button"
        accessibilityLabel="Kerahat vakitleri ve iç çember ayarlarını aç"
        onPress={()=>router.push('/kerahat-settings')}
        style={[styles.share,{backgroundColor:colors.soft}]}>
        <MaterialCommunityIcons name="weather-sunset" size={20} color={colors.gold}/>
        <View style={{flex:1,gap:4}}>
          <Text style={{color:colors.text,fontSize:14,fontWeight:'800'}}>
            Kerahat Vakitleri
          </Text>
          <Text style={{color:colors.muted,fontSize:11,lineHeight:17}}>
            İç halka, görünüm ve kerahat zaman aralıkları
          </Text>
        </View>
        <Feather name="chevron-right" size={19} color={colors.gold}/>
      </Pressable>
    </Panel>
    <Panel>
      <View style={styles.heading}>
        <Feather name="bell" size={19} color={colors.gold}/>
        <Text style={[styles.headingText,{color:colors.text}]}>Widget ve Bildirimler</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Widget ve namaz vakti bildirimlerini yönet"
        onPress={()=>router.push('/companion')}
        style={[styles.share,{backgroundColor:colors.soft}]}>
        <Feather name="smartphone" size={18} color={colors.emerald}/>
        <View style={{flex:1,gap:4}}>
          <Text style={{color:colors.text,fontSize:14,fontWeight:'800'}}>Ana ekran widget’ları ve uyarılar</Text>
          <Text style={{color:colors.muted,fontSize:11,lineHeight:17}}>
            İki widget, vakte özel bildirimler, ses/sessiz ve bildirim geçmişi
          </Text>
        </View>
        <Feather name="chevron-right" size={19} color={colors.gold}/>
      </Pressable>
    </Panel>
    <Panel>
      <View style={styles.heading}>
        <Feather name="info" size={19} color={colors.gold}/>
        <Text style={[styles.headingText,{color:colors.text}]}>Uygulama hakkında</Text>
      </View>
      <Text style={{fontSize:12,lineHeight:20,color:colors.muted}}>
        Camideyiz Biz · Namaz vakitleri, kıble, camiler ve günlük içerikler.
      </Text>
      <Pressable accessibilityRole="button" style={[styles.share,{backgroundColor:colors.soft}]}
        onPress={()=>Share.share({message:'Camideyiz Biz — namaz vakitleri ve içerik deneyimi.'}).catch(()=>undefined)}>
        <Feather name="share-2" color={colors.emerald} size={16}/>
        <Text style={{color:colors.text,fontWeight:'700',fontSize:13}}>Uygulamayı paylaş</Text>
      </Pressable>
    </Panel>
  </Page>;
}
const styles=StyleSheet.create({
  heading:{flexDirection:'row',alignItems:'center',gap:10},
  headingText:{fontSize:17,fontWeight:'700',fontFamily:'serif'},
  mode:{flex:1,minHeight:68,alignItems:'center',justifyContent:'center',gap:6,borderRadius:14,borderWidth:1.3},
  share:{minHeight:47,borderRadius:13,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:8},
});
