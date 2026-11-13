import {Tabs} from 'expo-router';
import {Feather,MaterialCommunityIcons} from '@expo/vector-icons';
import {useAppTheme} from '@/theme/ThemeProvider';
export default function TabLayout(){
  const {colors}=useAppTheme();
  return <Tabs screenOptions={{
    headerShown:false,tabBarActiveTintColor:colors.gold,tabBarInactiveTintColor:colors.muted,
    tabBarStyle:{backgroundColor:colors.surface,borderTopColor:colors.border,borderTopWidth:1,height:70,paddingTop:8,paddingBottom:7},
    tabBarLabelStyle:{fontSize:10,fontWeight:'600'}
  }}>
    <Tabs.Screen name="index" options={{title:'Vakitler',tabBarIcon:({color,size})=><MaterialCommunityIcons name="clock-time-four-outline" color={color} size={size}/>}}/>
    <Tabs.Screen name="mosques" options={{title:'Yakın Camiler',tabBarIcon:({color,size})=><MaterialCommunityIcons name="mosque" color={color} size={size}/>}}/>
    <Tabs.Screen name="qibla" options={{title:'Kıble',tabBarIcon:({color,size})=><Feather name="compass" color={color} size={size}/>}}/>
    <Tabs.Screen name="gallery" options={{title:'Galeri',tabBarIcon:({color,size})=><Feather name="image" color={color} size={size}/>}}/>
    <Tabs.Screen name="more" options={{title:'Menü',tabBarIcon:({color,size})=><Feather name="menu" color={color} size={size}/>}}/>
  </Tabs>;
}
