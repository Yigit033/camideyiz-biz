import {Stack} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {ThemeProvider,useAppTheme} from '@/theme/ThemeProvider';

function Navigation() {
  const {colors}=useAppTheme();
  return <>
    <StatusBar style={colors.isDark?'light':'dark'}/>
    <Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:colors.canvas}}}>
      <Stack.Screen name="(tabs)"/>
    </Stack>
  </>;
}
export default function RootLayout(){
  return <GestureHandlerRootView style={{flex:1}}>
    <SafeAreaProvider><ThemeProvider><Navigation/></ThemeProvider></SafeAreaProvider>
  </GestureHandlerRootView>;
}
