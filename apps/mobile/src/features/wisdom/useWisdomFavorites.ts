import {useCallback,useEffect,useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {WISDOM_LIBRARY} from '@camideyiz/core';
const KEY='@camideyiz/wisdom-favorites/v2';
const ALLOWED=new Set(WISDOM_LIBRARY.map(i=>i.id));

export function useWisdomFavorites(){
  const [saved,setSaved]=useState<readonly string[]>([]);
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    let live=true;
    AsyncStorage.getItem(KEY).then(raw=>{
      if(!live||!raw)return;
      try{
        const data:unknown=JSON.parse(raw);
        if(Array.isArray(data)&&data.length<=WISDOM_LIBRARY.length &&
          data.every(v=>typeof v==='string'&&ALLOWED.has(v))){
          setSaved([...new Set(data as string[])]);
        }
      }catch{/* ignore invalid old cache */}
    }).catch(()=>undefined).finally(()=>{if(live)setReady(true);});
    return ()=>{live=false;};
  },[]);
  // Persist only after the first load. Never perform IO from a React state
  // updater, which can be re-evaluated during concurrent rendering.
  useEffect(()=>{
    if(!ready)return;
    AsyncStorage.setItem(KEY,JSON.stringify(saved)).catch(()=>undefined);
  },[ready,saved]);
  const toggle=useCallback((id:string)=>{
    if(!ready||!ALLOWED.has(id))return;
    setSaved(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);
  },[ready]);
  return {saved,ready,toggle};
}
