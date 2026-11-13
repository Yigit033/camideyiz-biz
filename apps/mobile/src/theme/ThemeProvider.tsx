import AsyncStorage from '@react-native-async-storage/async-storage';
import {createContext,useContext,useEffect,useMemo,useState,type PropsWithChildren} from 'react';
import {useColorScheme} from 'react-native';
import {type ColorTokens,type ThemeMode,darkTokens,lightTokens} from './tokens';
type AppTheme={colors:ColorTokens;mode:ThemeMode;setMode:(mode:ThemeMode)=>void};
const ThemeContext=createContext<AppTheme|null>(null);
const KEY='@camideyiz/theme/v1';
export function ThemeProvider({children}:PropsWithChildren) {
  const systemMode=useColorScheme();
  const [mode,updateMode]=useState<ThemeMode>('system');
  useEffect(()=>{
    let active=true;
    AsyncStorage.getItem(KEY).then(stored=>{
      if(active&&(stored==='light'||stored==='dark'||stored==='system'))updateMode(stored);
    }).catch(()=>undefined);
    return ()=>{active=false;};
  },[]);
  const setMode=(next:ThemeMode)=>{
    updateMode(next);
    AsyncStorage.setItem(KEY,next).catch(()=>undefined);
  };
  const resolved=mode==='system'?(systemMode==='dark'?'dark':'light'):mode;
  const value=useMemo(()=>({colors:resolved==='dark'?darkTokens:lightTokens,mode,setMode}),[mode,resolved]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export function useAppTheme():AppTheme {
  const context=useContext(ThemeContext);
  if(!context) throw new Error('useAppTheme must be used inside ThemeProvider');
  return context;
}
