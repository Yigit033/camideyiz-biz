import {Tabs} from 'expo-router';
import {View} from 'react-native';
import {Feather, MaterialCommunityIcons} from '@expo/vector-icons';
import {useAppTheme} from '@/theme/ThemeProvider';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

function JewelTab({focused,children}: {focused:boolean;children:React.ReactNode}){
  const {colors}=useAppTheme();
  const dark=colors.isDark;
  return <View style={{
    alignItems:'center',justifyContent:'center',
    width:47,height:39,borderRadius:focused?23:14,
    backgroundColor:focused?(dark?'#0A5041':'#E7DDC4'):'transparent',
    borderWidth:focused?1.7:0,
    borderColor:dark?'#F4D38E':'#B48C53',
    shadowColor:focused?'#F6C56D':'transparent',
    shadowOpacity:focused?.46:0,shadowRadius:11,
    elevation:focused?5:0,
  }}>
    {children}
    {focused?<View style={{
      position:'absolute',height:2,width:27,borderRadius:2,
      bottom:-8,backgroundColor:'#F5D28C',
      shadowColor:'#E2BD73',shadowOpacity:.7,shadowRadius:4,
    }}/>:null}
  </View>;
}
export default function TabLayout(){
  const {colors}=useAppTheme();
  const insets=useSafeAreaInsets();
  const dark=colors.isDark;
  const bottomSpace=Math.max(6,insets.bottom);
  const glyph=(focused:boolean)=>focused?'#FFE2A0':dark?'#EBDCB7':'#4C6B5C';
  return <Tabs screenOptions={{
    headerShown:false,
    tabBarActiveTintColor:dark?'#EED49E':'#97764A',
    tabBarInactiveTintColor:dark?'#B7CBC5':'#345749',
    tabBarStyle:{
      backgroundColor:dark?'#073B32':'#FFFCF6',
      borderTopColor:dark?'#A3844C':'#D9C59F',
      borderTopWidth:1,
      borderTopLeftRadius:23,borderTopRightRadius:23,
      height:72+bottomSpace,paddingTop:7,paddingBottom:bottomSpace,
      shadowColor:'#A58755',shadowOpacity:.17,shadowRadius:14,
      elevation:10,
    },
    tabBarLabelStyle:{fontFamily:'serif',fontSize:11,fontWeight:'600',marginTop:2,lineHeight:15},
    tabBarItemStyle:{paddingHorizontal:0,paddingTop:0},
  }}>
    <Tabs.Screen name="index" options={{
      title:'Ana Sayfa',
      tabBarIcon:({focused})=><JewelTab focused={focused}>
        <Feather name="home" color={glyph(focused)} size={21}/>
      </JewelTab>,
    }}/>
    <Tabs.Screen name="mosques" options={{
      title:'Camiler',
      tabBarIcon:({focused})=><JewelTab focused={focused}>
        <MaterialCommunityIcons name="mosque" color={glyph(focused)} size={23}/>
      </JewelTab>,
    }}/>
    <Tabs.Screen name="qibla" options={{
      title:'Kıble',
      tabBarIcon:({focused})=><JewelTab focused={focused}>
        <Feather name="compass" color={glyph(focused)} size={21}/>
      </JewelTab>,
    }}/>
    <Tabs.Screen name="gallery" options={{
      title:'Galeri',
      tabBarIcon:({focused})=><JewelTab focused={focused}>
        <Feather name="image" color={glyph(focused)} size={21}/>
      </JewelTab>,
    }}/>
    <Tabs.Screen name="more" options={{
      title:'Diğer',
      tabBarIcon:({focused})=><JewelTab focused={focused}>
        <Feather name="more-horizontal" color={glyph(focused)} size={23}/>
      </JewelTab>,
    }}/>
  </Tabs>;
}
