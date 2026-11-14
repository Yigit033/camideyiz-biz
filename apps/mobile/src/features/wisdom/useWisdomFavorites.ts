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
  const toggle=useCallback((id:string)=>{
    if(!ready||!ALLOWED.has(id))return;
    setSaved(old=>{
      const next=old.includes(id)?old.filter(x=>x!==id):[...old,id];
      AsyncStorage.setItem(KEY,JSON.stringify(next)).catch(()=>undefined);
      return next;
    });
  },[ready]);
  return {saved,ready,toggle};
}
