import AsyncStorage from '@react-native-async-storage/async-storage';
import {createContext,useContext,useEffect,useMemo,useState,type PropsWithChildren} from 'react';
import {NativeModules,Platform,useColorScheme} from 'react-native';
import {type ColorTokens,type ThemeMode,darkTokens,lightTokens} from './tokens';
type AppTheme={colors:ColorTokens;mode:ThemeMode;setMode:(mode:ThemeMode)=>void};
const ThemeContext=createContext<AppTheme|null>(null);
const KEY='@camideyiz/theme/v1';
export function ThemeProvider({children}:PropsWithChildren) {
  const systemMode=useColorScheme();
  const [mode,updateMode]=useState<ThemeMode>('system');
  const [hydrated,setHydrated]=useState(false);
  useEffect(()=>{
    let active=true;
    AsyncStorage.getItem(KEY).then(stored=>{
      if(active&&(stored==='light'||stored==='dark'||stored==='system'))updateMode(stored);
    }).catch(()=>undefined).finally(()=>{if(active)setHydrated(true);});
    return ()=>{active=false;};
  },[]);
  const setMode=(next:ThemeMode)=>{
    updateMode(next);
    AsyncStorage.setItem(KEY,next).catch(()=>undefined);
  };
  const resolved=mode==='system'?(systemMode==='dark'?'dark':'light'):mode;
  useEffect(()=>{
    // Native appearance is persisted only after user settings are loaded.
    // The bridge skips unchanged values and performs all widget repaint work
    // on its existing background queue: no calendar re-fetch or main-thread IO.
    if(!hydrated||Platform.OS!=='android')return;
    const native=NativeModules.CamideyizWidgetBridge as {
      setAppearance?:(mode:ThemeMode,resolved:'light'|'dark')=>Promise<boolean>;
    }|undefined;
    if(typeof native?.setAppearance==='function')
      native.setAppearance(mode,resolved).catch(()=>undefined);
  },[hydrated,mode,resolved]);
  const value=useMemo(()=>({colors:resolved==='dark'?darkTokens:lightTokens,mode,setMode}),[mode,resolved]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export function useAppTheme():AppTheme {
  const context=useContext(ThemeContext);
  if(!context) throw new Error('useAppTheme must be used inside ThemeProvider');
  return context;
}
