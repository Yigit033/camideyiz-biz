import {Tabs} from 'expo-router';
import {View} from 'react-native';
import {Feather, MaterialCommunityIcons} from '@expo/vector-icons';
import {useAppTheme} from '@/theme/ThemeProvider';

function IconShell({focused, children}: {focused: boolean; children: React.ReactNode}) {
  const {colors} = useAppTheme();
  return <View style={{
    width: 44, height: 33, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: focused ? colors.soft : 'transparent',
    borderWidth: focused ? 1 : 0,
    borderColor: colors.isDark ? '#4B7664' : '#D5E3D9',
  }}>{children}</View>;
}
export default function TabLayout() {
  const {colors} = useAppTheme();
  const iconColor = (color: unknown) => typeof color === 'string' ? color : colors.muted;
  return <Tabs screenOptions={{
    headerShown: false,
    tabBarActiveTintColor: colors.isDark ? '#D9C18D' : '#947B51',
    tabBarInactiveTintColor: colors.muted,
    tabBarStyle: {
      backgroundColor: colors.surface,
      borderTopColor: colors.border, borderTopWidth: 1,
      height: 78, paddingTop: 7, paddingBottom: 7,
    },
    tabBarLabelStyle: {fontSize: 10, fontWeight: '700', letterSpacing: .05},
    tabBarItemStyle: {paddingHorizontal: 1},
  }}>
    <Tabs.Screen name="index" options={{
      title: 'Vakitler',
      tabBarIcon: ({color, focused}) => <IconShell focused={focused}>
        <MaterialCommunityIcons name="clock-time-four-outline" color={iconColor(color)} size={23}/>
      </IconShell>,
    }}/>
    <Tabs.Screen name="mosques" options={{
      title: 'Camiler',
      tabBarIcon: ({color, focused}) => <IconShell focused={focused}>
        <MaterialCommunityIcons name="mosque" color={iconColor(color)} size={23}/>
      </IconShell>,
    }}/>
    <Tabs.Screen name="qibla" options={{
      title: 'Kıble',
      tabBarIcon: ({color, focused}) => <IconShell focused={focused}>
        <Feather name="compass" color={iconColor(color)} size={22}/>
      </IconShell>,
    }}/>
    <Tabs.Screen name="gallery" options={{
      title: 'Galeri',
      tabBarIcon: ({color, focused}) => <IconShell focused={focused}>
        <Feather name="image" color={iconColor(color)} size={22}/>
      </IconShell>,
    }}/>
    <Tabs.Screen name="more" options={{
      title: 'Menü',
      tabBarIcon: ({color, focused}) => <IconShell focused={focused}>
        <Feather name="menu" color={iconColor(color)} size={22}/>
      </IconShell>,
    }}/>
  </Tabs>;
}
