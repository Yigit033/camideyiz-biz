import {useEffect,useState} from 'react';
import {
  Image,Pressable,ScrollView,StyleSheet,Text,View,useWindowDimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Feather} from '@expo/vector-icons';
import {router,useLocalSearchParams} from 'expo-router';
import {useAppTheme} from '@/theme/ThemeProvider';

/** UNALTERED user-provided 1126×2000 teaching posters.
 * Do not crop, recolour, redraw, place overlays on, or reflow their text.
 * The two image files are required native bundle assets.
 */
const POSTERS={
  heavy:require('../../assets/kerahat/agir-kerahat.png'),
  light:require('../../assets/kerahat/hafif-kerahat.png'),
} as const;
const ORIGINAL_WIDTH=1126;
const ORIGINAL_HEIGHT=2000;
type Tab='heavy'|'light';
const TABS:readonly {key:Tab;label:string}[]=[
  {key:'heavy',label:'Ağır Kerahat'},
  {key:'light',label:'Hafif Kerahat'},
];

export default function KerahatGuideScreen(){
  const params=useLocalSearchParams<{tab?:string}>();
  const [tab,setTab]=useState<Tab>(
    params.tab==='light'?'light':'heavy');
  const [zoomed,setZoomed]=useState(false);
  const {width}=useWindowDimensions();
  const {colors}=useAppTheme();

  useEffect(()=>{
    setTab(params.tab==='light'?'light':'heavy');
    setZoomed(false);
  },[params.tab]);

  // Posters retain the exact original aspect ratio. On narrow phones the
  // zoom mode gives a 2x horizontally scrollable reading surface; it never
  // crops the edges or shrinks the original text to a different layout.
  const viewportWidth=Math.max(240,width-28);
  const posterWidth=zoomed?viewportWidth*2:viewportWidth;
  const posterHeight=posterWidth*ORIGINAL_HEIGHT/ORIGINAL_WIDTH;
  const selected=tab==='heavy'
    ?'Ağır Kerahat Vakitleri':'Hafif Kerahat Vakitleri';

  return <SafeAreaView edges={['top']}
    style={[styles.screen,{backgroundColor:colors.canvas}]}>
    <View style={[styles.top,{borderBottomColor:colors.border}]}>
      <Pressable onPress={()=>router.back()}
        accessibilityRole="button" accessibilityLabel="Geri dön"
        style={[styles.back,{borderColor:colors.border,
          backgroundColor:colors.surface}]}>
        <Feather name="arrow-left" color={colors.text} size={21}/>
      </Pressable>
      <View style={styles.heading}>
        <Text style={[styles.title,{color:colors.text}]}>Kerahat Vakitleri</Text>
        <Text style={[styles.subtitle,{color:colors.muted}]}>
          Ağır ve hafif kerahat rehberi
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={zoomed?'Görseli normal boyuta küçült':'Görseli okumak için büyüt'}
        accessibilityState={{expanded:zoomed}}
        onPress={()=>setZoomed(value=>!value)}
        style={[styles.zoom,{borderColor:colors.border,
          backgroundColor:zoomed?colors.soft:colors.surface}]}>
        <Feather name={zoomed?'minimize-2':'maximize-2'}
          color={colors.gold} size={19}/>
      </Pressable>
    </View>

    <View accessibilityRole="tablist"
      style={[styles.tabs,{backgroundColor:colors.surface,
        borderColor:colors.border}]}>
      {TABS.map(item=>{
        const active=tab===item.key;
        return <Pressable key={item.key} accessibilityRole="tab"
          accessibilityState={{selected:active}}
          onPress={()=>{setTab(item.key);setZoomed(false);}}
          style={[styles.tab,{
            backgroundColor:active
              ?item.key==='heavy'?'#8F3A42':'#116D71'
              :'transparent',
          }]}>
          <Text style={[styles.tabText,{
            color:active?'#FFF9ED':colors.text,
          }]}>{item.label}</Text>
        </Pressable>;
      })}
    </View>

    <ScrollView key={tab+'-'+(zoomed?'large':'normal')}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.page}>
      <View style={styles.imageFrame}>
        <ScrollView horizontal={zoomed}
          nestedScrollEnabled
          bounces={false}
          showsHorizontalScrollIndicator={zoomed}
          contentContainerStyle={{
            width:posterWidth,
            justifyContent:'flex-start',
          }}>
          <Image
            source={POSTERS[tab]}
            resizeMode="contain"
            accessibilityLabel={selected+'; kullanıcının gönderdiği orijinal bilgilendirme görseli'}
            style={{width:posterWidth,height:posterHeight,
              backgroundColor:'#E8E8E8'}}
          />
        </ScrollView>
      </View>
      {zoomed?<Text style={[styles.hint,{color:colors.muted}]}>
        Büyütülmüş görseli sağa ve sola kaydırarak okuyabilirsin.
      </Text>:<Pressable accessibilityRole="button"
        onPress={()=>setZoomed(true)}
        style={styles.expand}>
        <Feather name="zoom-in" size={15} color={colors.gold}/>
        <Text style={[styles.hint,{color:colors.muted}]}>
          Daha büyük okumak için görsele yakınlaştır
        </Text>
      </Pressable>}
    </ScrollView>
  </SafeAreaView>;
}

const styles=StyleSheet.create({
  screen:{flex:1},
  top:{flexDirection:'row',alignItems:'center',gap:10,
    paddingHorizontal:14,paddingTop:11,paddingBottom:12,
    borderBottomWidth:1},
  back:{height:42,width:42,borderRadius:14,borderWidth:1,
    alignItems:'center',justifyContent:'center'},
  heading:{flex:1,gap:4},
  title:{fontFamily:'serif',fontSize:19,fontWeight:'800'},
  subtitle:{fontSize:10.5},
  zoom:{height:42,width:42,borderRadius:14,borderWidth:1,
    alignItems:'center',justifyContent:'center'},
  tabs:{marginHorizontal:14,marginTop:12,marginBottom:9,
    borderRadius:16,borderWidth:1,padding:5,
    flexDirection:'row',gap:5},
  tab:{flex:1,minHeight:45,borderRadius:12,alignItems:'center',
    justifyContent:'center',paddingHorizontal:5},
  tabText:{fontSize:12,fontWeight:'800',textAlign:'center'},
  page:{alignItems:'center',paddingHorizontal:14,paddingBottom:30},
  imageFrame:{overflow:'hidden',width:'100%',
    backgroundColor:'#E8E8E8'},
  hint:{fontSize:11.5,lineHeight:18,textAlign:'center'},
  expand:{paddingVertical:13,alignSelf:'center',flexDirection:'row',
    alignItems:'center',gap:7},
});
