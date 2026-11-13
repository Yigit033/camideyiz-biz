import {Linking,Pressable,Text,View} from 'react-native';
import {Feather,MaterialCommunityIcons} from '@expo/vector-icons';
import {Page,Panel} from '@/components/Page';
import {useAppTheme} from '@/theme/ThemeProvider';
export default function NearbyMosques(){
  const {colors}=useAppTheme();
  const openGoogleMaps=async()=>{
    const url='https://www.google.com/maps/search/?api=1&query=cami';
    try{await Linking.openURL(url);}catch{ /* no external app available */ }
  };
  return <Page title="Yakın Camiler" subtitle="Bulunduğun yere yakın camileri haritada keşfet.">
    <Panel>
      <View style={{height:150,alignItems:'center',justifyContent:'center',gap:12,borderRadius:18,backgroundColor:colors.soft}}>
        <MaterialCommunityIcons name="mosque" size={56} color={colors.gold}/>
        <Text style={{color:colors.text,fontSize:17,fontWeight:'700'}}>Cami keşfi</Text>
      </View>
      <Text style={{color:colors.muted,lineHeight:22}}>İlk sürümde Google Haritalar'da cami araması açılır. Uygulama içi liste için ayrı veri kaynağı gerekir.</Text>
      <Pressable accessibilityRole="button" onPress={openGoogleMaps} style={{backgroundColor:colors.emerald,borderRadius:14,padding:16,flexDirection:'row',justifyContent:'center',gap:8,alignItems:'center'}}>
        <Feather name="map-pin" size={17} color={colors.isDark?'#102722':'#FFFFFF'}/>
        <Text style={{fontWeight:'800',color:colors.isDark?'#102722':'#FFFFFF'}}>Google Haritalar'da cami ara</Text>
      </Pressable>
    </Panel>
    <Text style={{color:colors.muted,fontSize:12,lineHeight:20}}>Konuma göre uygulama içi sıralama sonraki sürümde geliştirilir.</Text>
  </Page>;
}
