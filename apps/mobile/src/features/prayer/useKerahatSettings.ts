import {useCallback,useEffect,useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_KERAHAT_SETTINGS,validateKerahatSettings,
  type KerahatSettings,
} from '@camideyiz/core';

const KEY='@camideyiz/kerahat-preferences/v2';
export function useKerahatSettings(){
  const [settings,setState]=useState<KerahatSettings>({...DEFAULT_KERAHAT_SETTINGS});
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    let active=true;
    AsyncStorage.getItem(KEY).then(raw=>{
      if(!active)return;
      if(raw){
        try{setState(validateKerahatSettings(JSON.parse(raw) as unknown));}
        catch{/* invalid stored preferences revert safely to official-inspired default */}
      }
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
