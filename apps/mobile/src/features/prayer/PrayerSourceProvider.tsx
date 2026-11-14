import {createContext,useContext,useEffect,useMemo,useState,type PropsWithChildren} from 'react';
import {AppState} from 'react-native';
import {usePrayerSource} from './usePrayerSource';

type PrayerSourceValue=ReturnType<typeof usePrayerSource>;
const Context=createContext<PrayerSourceValue|null>(null);

/** One source of truth for both Home and the native widget/notification sync.
 * This avoids double-fetching the public upstream from separate tabs.
 */
export function PrayerSourceProvider({children}:PropsWithChildren){
  const [now,setNow]=useState(()=>new Date());
  const prayer=usePrayerSource(now);
  useEffect(()=>{
    const minute=setInterval(()=>setNow(new Date()),30_000);
    const subscription=AppState.addEventListener('change',state=>{
      if(state==='active')setNow(new Date());
    });
    return ()=>{clearInterval(minute);subscription.remove();};
  },[]);
  const value=useMemo(()=>prayer,[prayer]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useSharedPrayerSource():PrayerSourceValue{
  const value=useContext(Context);
  if(!value)throw new Error('useSharedPrayerSource must be under PrayerSourceProvider');
  return value;
}
