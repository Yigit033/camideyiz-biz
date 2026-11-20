import '@/features/performance/startupMetrics'; // JS boot timing starts before other app imports.
import '@/features/widgets/widgetTaskRegistration'; // Lightweight synchronous headless task registration.
import {Stack} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {ThemeProvider,useAppTheme} from '@/theme/ThemeProvider';
import {PrayerSourceProvider} from '@/features/prayer/PrayerSourceProvider';
import {KerahatSettingsProvider} from '@/features/prayer/KerahatSettingsProvider';
import {CompanionProvider} from '@/features/companion/CompanionProvider';
import {AdhanPlaybackProvider} from '@/features/adhan/AdhanPlaybackProvider';

function Navigation() {
  const {colors}=useAppTheme();
  return <>
    <StatusBar style={colors.isDark?'light':'dark'}/>
    <Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:colors.canvas}}}>
      <Stack.Screen name="(tabs)"/>
      <Stack.Screen name="companion" options={{presentation:'card'}}/>
      <Stack.Screen name="kerahat-settings" options={{presentation:'card'}}/>
      <Stack.Screen name="kerahat-guide" options={{presentation:'card'}}/>
      <Stack.Screen name="calendar30" options={{presentation:'card'}}/>
      <Stack.Screen name="religious-days" options={{presentation:'card'}}/>
      <Stack.Screen name="gallery-editor" options={{presentation:'card'}}/>
    </Stack>
  </>;
}
export default function RootLayout(){
  return <GestureHandlerRootView style={{flex:1}}>
    <SafeAreaProvider>
      <ThemeProvider>
        <PrayerSourceProvider>
          <KerahatSettingsProvider>
            <AdhanPlaybackProvider>
              <CompanionProvider><Navigation/></CompanionProvider>
            </AdhanPlaybackProvider>
          </KerahatSettingsProvider>
        </PrayerSourceProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  </GestureHandlerRootView>;
}
