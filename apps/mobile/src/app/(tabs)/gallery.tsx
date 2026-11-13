import {useState} from 'react';
import {Alert,Linking,Pressable,Share,StyleSheet,Text,View} from 'react-native';
import {Feather,MaterialCommunityIcons} from '@expo/vector-icons';
import {Page} from '@/components/Page';
import {ArabesqueCorner,MosqueCrest} from '@/components/LuxuryArtwork';
import {useAppTheme} from '@/theme/ThemeProvider';

type SourceCard={
  id:string; kind:'ayet'|'hadis';title:string;excerpt:string;reference:string;url:string;
};
const CARDS:readonly SourceCard[]=[
  {id:'nisa103',kind:'ayet',title:'Vaktin Kıymeti',
    excerpt:'“Namaz, müminler üzerine vakitleri belli olarak yazılmış bir ödevdir.”',
    reference:'Nisâ Suresi, 4:103 · Diyanet Kur’an Yolu',
    url:'https://kuran.diyanet.gov.tr/tefsir/Nis%C3%A2-suresi/596/103-ayet-tefsiri'},
  {id:'niyet',kind:'hadis',title:'Niyetin Değeri',
    excerpt:'“Ameller niyete göredir.”',
    reference:"Buhârî, Bed'ü'l-vahy, 1 · Hadislerle İslam",
    url:'https://hadislerleislam.diyanet.gov.tr/pdf/hadislerle_islam_cilt3.pdf'},
];
export default function Gallery(){
  const {colors}=useAppTheme();
  const [sharing,setSharing]=useState<string|null>(null);
  const share=async(card:SourceCard)=>{
    setSharing(card.id);
    try {await Share.share({message:[card.excerpt,card.reference,card.url].join('\n')});}
    catch {Alert.alert('Paylaşım açılamadı','Cihazının paylaşım seçeneklerini kontrol et.');}
    finally {setSharing(null);}
  };
  const openSource=async(url:string)=>{
    try {await Linking.openURL(url);}
    catch {Alert.alert('Kaynak açılamadı','İnternet bağlantını kontrol et.');}
  };
  return <Page title="Paylaşım Galerisi" subtitle="Kaynağı belirtilmiş ayet ve hadislerden seçkiler.">
    {CARDS.map((card,index)=>{
      const darkBackground=index===0;
      const panel=darkBackground?'#093D35':colors.surface;
      const ink=darkBackground?'#FAF6EA':colors.text;
      const muted=darkBackground?'#C5DECC':colors.muted;
      return <View key={card.id} style={[styles.card,{
        backgroundColor:panel,borderColor:darkBackground?'#A8915D':colors.border,
      }]}>
        <ArabesqueCorner width={160} dark={darkBackground}/>
        <View style={styles.heading}>
          <Text style={{color:darkBackground?'#E8D19D':colors.gold,letterSpacing:2,fontSize:10,fontWeight:'800'}}>
            {card.kind==='ayet'?'KUR’AN-I KERİM':'HADİS-İ ŞERİF'}
          </Text>
          <MaterialCommunityIcons
            name={card.kind==='ayet'?'book-open-page-variant-outline':'script-text-outline'}
            color={colors.gold} size={23}/>
        </View>
        <View style={styles.art}>
          <MosqueCrest width={155} dark={darkBackground}/>
        </View>
        <Text style={[styles.title,{color:ink}]}>{card.title}</Text>
        <Text style={[styles.quote,{color:ink}]}>{card.excerpt}</Text>
        <Text style={[styles.source,{color:muted}]}>{card.reference}</Text>
        <View style={[styles.actions,{borderTopColor:darkBackground?'#44685D':colors.border}]}>
          <Pressable accessibilityRole="button" onPress={()=>openSource(card.url)} style={styles.action}>
            <Feather name="book-open" size={14} color={darkBackground?'#E8D19D':colors.gold}/>
            <Text style={{color:darkBackground?'#E8D19D':colors.gold,fontSize:12,fontWeight:'700'}}>Kaynağı aç</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={sharing===card.id} onPress={()=>share(card)} style={styles.action}>
            <Feather name="share-2" size={14} color={darkBackground?'#E8D19D':colors.gold}/>
            <Text style={{color:darkBackground?'#E8D19D':colors.gold,fontSize:12,fontWeight:'700'}}>Paylaş</Text>
          </Pressable>
        </View>
      </View>;
    })}
    <Text style={{color:colors.muted,fontSize:11,lineHeight:18,textAlign:'center'}}>
      Paylaşımlarda ayet ve hadis kaynakları korunur. Yeni içerikler kaynak kontrolünden sonra eklenir.
    </Text>
  </Page>;
}
const styles=StyleSheet.create({
  card:{borderRadius:25,borderWidth:1,padding:20,overflow:'hidden',gap:12},
  heading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  art:{alignItems:'center',height:67,justifyContent:'center'},
  title:{fontFamily:'serif',fontSize:25,fontWeight:'700'},
  quote:{fontFamily:'serif',fontStyle:'italic',fontSize:17,lineHeight:26},
  source:{fontFamily:'serif',fontSize:12},
  actions:{borderTopWidth:1,flexDirection:'row',justifyContent:'space-between',paddingTop:15,marginTop:7},
  action:{minHeight:36,flexDirection:'row',gap:7,alignItems:'center',paddingHorizontal:6},
});
