import {useCallback,useEffect,useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_KERAHAT_SETTINGS,validateKerahatSettings,
  migrateLegacyKerahatSettings,type KerahatSettings,
} from '@camideyiz/core';

// Separate schema key ensures an old installed APK's 45/10/45 factory profile
// upgrades once, while later explicit user edits are never reset on launch.
const KEY='@camideyiz/kerahat-preferences/v3';
const LEGACY_KEY='@camideyiz/kerahat-preferences/v2';
export function useKerahatSettings(){
  const [settings,setState]=useState<KerahatSettings>({...DEFAULT_KERAHAT_SETTINGS});
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    let active=true;
    AsyncStorage.getItem(KEY).then(async raw=>{
      if(!active)return;
      if(raw){
        try{
          setState(validateKerahatSettings(JSON.parse(raw) as unknown));
          return; // Valid v3 configuration is authoritative, including custom values.
        }catch{/* v3 damaged: attempt a safe v2 migration */ }
      }
      const legacy=await AsyncStorage.getItem(LEGACY_KEY);
      if(!active||!legacy)return;
      try{
        const migrated=migrateLegacyKerahatSettings(JSON.parse(legacy) as unknown);
        setState(migrated);
        await AsyncStorage.setItem(KEY,JSON.stringify(migrated));
      }catch{/* Invalid old preferences fall back to new factory defaults. */}
    }).catch(()=>undefined).finally(()=>{if(active)setReady(true);});
    return ()=>{active=false;};
  },[]);
  const update=useCallback((next:KerahatSettings)=>{
    const valid=validateKerahatSettings(next);
    setState(valid);
    // Preserve local-only user preference. No server account or device location sent.
    AsyncStorage.setItem(KEY,JSON.stringify(valid)).catch(()=>undefined);
  },[]);
  return {settings,update,ready};
}
