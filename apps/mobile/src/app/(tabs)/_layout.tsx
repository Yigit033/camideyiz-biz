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
    width:49,height:36,borderRadius:13,
    backgroundColor:focused?(dark?'#08765E':'#087051'):'transparent',
    borderWidth:focused?1:0,
    borderColor:dark?'#5FD8B4':'#BFC99C',
    shadowColor:focused?'#15D4A4':'transparent',
    shadowOpacity:focused?.38:0,shadowRadius:9,
    elevation:focused?5:0,
  }}>
    {children}
    {focused?<View style={{
      position:'absolute',height:2,width:27,borderRadius:2,
      bottom:2,backgroundColor:'#F5D28C',
      shadowColor:'#E2BD73',shadowOpacity:.7,shadowRadius:4,
    }}/>:null}
  </View>;
}
export default function TabLayout(){
  const {colors}=useAppTheme();
  const insets=useSafeAreaInsets();
  const dark=colors.isDark;
  const bottomSpace=Math.max(6,insets.bottom);
  const glyph=(focused:boolean)=>focused?'#F8E9C5':dark?'#D3DDD6':'#3A6254';
  return <Tabs screenOptions={{
    headerShown:false,
    tabBarActiveTintColor:dark?'#EED49E':'#97764A',
    tabBarInactiveTintColor:dark?'#B7CBC5':'#345749',
    tabBarStyle:{
      backgroundColor:dark?'#082827':'#FFFCF6',
      borderTopColor:dark?'#397968':'#D9C59F',
      borderTopWidth:1,
      borderTopLeftRadius:23,borderTopRightRadius:23,
      height:68+bottomSpace,paddingTop:6,paddingBottom:bottomSpace,
      shadowColor:'#A58755',shadowOpacity:.17,shadowRadius:14,
      elevation:10,
    },
    tabBarLabelStyle:{fontFamily:'serif',fontSize:11,fontWeight:'600',marginTop:2,lineHeight:15},
    tabBarItemStyle:{paddingHorizontal:0,paddingTop:0},
  }}>
    <Tabs.Screen name="index" options={{
      title:'Vakitler',
      tabBarIcon:({focused})=><JewelTab focused={focused}>
        <MaterialCommunityIcons name="mosque" color={glyph(focused)} size={21}/>
      </JewelTab>,
    }}/>
    <Tabs.Screen name="mosques" options={{
      title:'Camiler',
      tabBarIcon:({focused})=><JewelTab focused={focused}>
        <MaterialCommunityIcons name="map-marker-radius-outline" color={glyph(focused)} size={23}/>
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
      title:'Menü',
      tabBarIcon:({focused})=><JewelTab focused={focused}>
        <Feather name="menu" color={glyph(focused)} size={22}/>
      </JewelTab>,
    }}/>
  </Tabs>;
}
