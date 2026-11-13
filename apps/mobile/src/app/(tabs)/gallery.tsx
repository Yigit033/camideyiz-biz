import {Text,View} from 'react-native';
import {Feather} from '@expo/vector-icons';
import {Page,Panel} from '@/components/Page';
import {useAppTheme} from '@/theme/ThemeProvider';
export default function Gallery(){
  const {colors}=useAppTheme();
  return <Page title="Galeri" subtitle="Fotoğraflar, anlamlı mesajlar ve kaynak bilgisiyle paylaşım deneyimi.">
    <Panel>
      <View style={{height:200,borderRadius:18,backgroundColor:colors.soft,alignItems:'center',justifyContent:'center',gap:12}}>
        <Feather name="image" size={52} color={colors.gold}/>
        <Text style={{color:colors.text,fontWeight:'700',fontSize:17}}>Hikâyeni paylaş</Text>
        <Text style={{color:colors.muted,textAlign:'center',paddingHorizontal:25}}>Fotoğraf galerisi ve kaynaklı paylaşım editörü hazırlanıyor.</Text>
      </View>
      <Text style={{color:colors.muted,lineHeight:21,fontSize:13}}>Fotoğraf hakları ve kaynak atıfları doğrulandıktan sonra içerikler burada gösterilecek.</Text>
    </Panel>
  </Page>;
}
