import {useEffect,useState} from 'react';
import {
  Image,Pressable,ScrollView,StyleSheet,Text,View,useWindowDimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Feather} from '@expo/vector-icons';
import {router,useLocalSearchParams} from 'expo-router';
import {useAppTheme} from '@/theme/ThemeProvider';

/**
 * Lossless WebP copies of user-supplied 1126 × 2000 PNG teaching posters.
 * Never edit, recolour, crop, cover or redraw the poster pixels/text.
 */
const POSTERS={
  heavy:require('../../assets/kerahat/agir-kerahat.webp'),
  light:require('../../assets/kerahat/hafif-kerahat.webp'),
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
  const [tab,setTab]=useState<Tab>(params.tab==='light'?'light':'heavy');
  const [zoomed,setZoomed]=useState(false);
  const {width}=useWindowDimensions();
  const {colors}=useAppTheme();

  useEffect(()=>{
    setTab(params.tab==='light'?'light':'heavy');
    setZoomed(false);
  },[params.tab]);

  // Full poster fit at 1×; 2× uses horizontal pan and the parent vertical
  // scroll. No nested same-direction ScrollView in the non-zoomed state.
  // Limit tablet width to a readable poster column without altering pixels.
  const viewportWidth=Math.max(1,Math.min(560,width-28));
  const posterWidth=zoomed?viewportWidth*2:viewportWidth;
  const posterHeight=posterWidth*ORIGINAL_HEIGHT/ORIGINAL_WIDTH;
  const selected=tab==='heavy'
    ?'Ağır Kerahat Vakitleri':'Hafif Kerahat Vakitleri';

  // Expo resolves dimensions for bundled static PNGs. The temporary 1×1
  // placeholders must never masquerade as the original teaching posters.
  // Release builds additionally enforce the exact original SHA-256 hashes.
  const metadata=Image.resolveAssetSource(POSTERS[tab]);
  const posterReady=metadata?.width===ORIGINAL_WIDTH &&
    metadata?.height===ORIGINAL_HEIGHT;
  const poster=posterReady?<Image
    source={POSTERS[tab]}
    resizeMode="contain"
    accessible
    accessibilityLabel={selected+'; orijinal bilgilendirme görseli'}
    style={{width:posterWidth,height:posterHeight,backgroundColor:'#E8E8E8'}}
  />:null;

  return <SafeAreaView edges={['top','bottom']}
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
        disabled={!posterReady}
        onPress={()=>setZoomed(value=>!value)}
        style={[styles.zoom,{borderColor:colors.border,
          backgroundColor:zoomed?colors.soft:colors.surface,
          opacity:posterReady?1:.45}]}>
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
      bounces={false}
      contentContainerStyle={styles.page}>
      <View style={[styles.imageFrame,{width:viewportWidth}]}>
        {!posterReady?
          <View style={[styles.unavailable,{borderColor:colors.border}]}>
            <Feather name="alert-triangle" size={26} color={colors.gold}/>
            <Text style={[styles.unavailableTitle,{color:colors.text}]}>
              Orijinal görsel henüz eklenmedi
            </Text>
            <Text style={[styles.unavailableDetail,{color:colors.muted}]}>
              Görselin geçici bir kopyası yerine orijinal dosyası gereklidir.
            </Text>
          </View>
        :zoomed?
          <ScrollView horizontal nestedScrollEnabled bounces={false}
            showsHorizontalScrollIndicator
            style={{width:viewportWidth}}
            contentContainerStyle={{width:posterWidth}}>
            {poster}
          </ScrollView>
        :
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={selected+' görselini büyüt'}
            onPress={()=>setZoomed(true)}>
            {poster}
          </Pressable>
        }
      </View>
      {posterReady?(zoomed?
        <Text style={[styles.hint,{color:colors.muted}]}>
          Büyütülmüş görseli sağa ve sola kaydırarak okuyabilirsin.
        </Text>
      :
        <Pressable accessibilityRole="button"
          accessibilityLabel="Görseli iki kat büyüt"
          onPress={()=>setZoomed(true)}
          style={styles.expand}>
          <Feather name="zoom-in" size={16} color={colors.gold}/>
          <Text style={[styles.hint,{color:colors.muted}]}>
            Yakından okumak için görsele dokun
          </Text>
        </Pressable>):null}
    </ScrollView>
  </SafeAreaView>;
}

const styles=StyleSheet.create({
  screen:{flex:1},
  top:{flexDirection:'row',alignItems:'center',gap:10,
    paddingHorizontal:14,paddingTop:11,paddingBottom:12,
    borderBottomWidth:1},
  back:{height:44,width:44,borderRadius:14,borderWidth:1,
    alignItems:'center',justifyContent:'center'},
  heading:{flex:1,gap:4},
  title:{fontFamily:'serif',fontSize:19,fontWeight:'800'},
  subtitle:{fontSize:10.5},
  zoom:{height:44,width:44,borderRadius:14,borderWidth:1,
    alignItems:'center',justifyContent:'center'},
  tabs:{marginHorizontal:14,marginTop:12,marginBottom:9,
    borderRadius:16,borderWidth:1,padding:5,
    flexDirection:'row',gap:5},
  tab:{flex:1,minHeight:45,borderRadius:12,alignItems:'center',
    justifyContent:'center',paddingHorizontal:5},
  tabText:{fontSize:12,fontWeight:'800',textAlign:'center'},
  page:{alignItems:'center',paddingHorizontal:14,paddingBottom:30},
  imageFrame:{overflow:'hidden',backgroundColor:'#E8E8E8',
    alignItems:'center'},
  hint:{fontSize:11.5,lineHeight:18,textAlign:'center'},
  expand:{paddingVertical:13,alignSelf:'center',flexDirection:'row',
    alignItems:'center',gap:7},
  unavailable:{width:'100%',minHeight:270,borderWidth:1,
    justifyContent:'center',alignItems:'center',gap:10,padding:25},
  unavailableTitle:{fontSize:14,fontWeight:'700',textAlign:'center'},
  unavailableDetail:{fontSize:12,lineHeight:19,textAlign:'center'},
});
