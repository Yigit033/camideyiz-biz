import AsyncStorage from '@react-native-async-storage/async-storage';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {type MosqueRecord} from '@camideyiz/core';
const KEY='@camideyiz/mosque-favorites/v2';
function safeRecord(value:unknown):value is MosqueRecord{
  if(!value||typeof value!=='object')return false;
  const r=value as MosqueRecord;
  return /^(node|way|relation)\/\d{1,16}$/.test(r.id)&&
    Number.isFinite(r.latitude)&&Math.abs(r.latitude)<=90&&
    Number.isFinite(r.longitude)&&Math.abs(r.longitude)<=180&&
    typeof r.name==='string'&&r.name.length>0&&r.name.length<200;
}
export function useMosqueFavorites(){
  const [saved,setSaved]=useState<MosqueRecord[]>([]);
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    let mounted=true;
    AsyncStorage.getItem(KEY).then(text=>{
      if(!mounted)return;
      if(text){const decoded:unknown=JSON.parse(text);if(Array.isArray(decoded))
        setSaved(decoded.filter(safeRecord).slice(0,300));}
    }).catch(()=>undefined).finally(()=>{if(mounted)setReady(true);});
    return ()=>{mounted=false;};
  },[]);
  const ids=useMemo(()=>new Set(saved.map(x=>x.id)),[saved]);
  const toggle=useCallback((item:MosqueRecord)=>{
    setSaved(old=>{
      const updated=old.some(x=>x.id===item.id)
        ?old.filter(x=>x.id!==item.id)
        :[item,...old].slice(0,300);
      AsyncStorage.setItem(KEY,JSON.stringify(updated)).catch(()=>undefined);
      return updated;
    });
  },[]);
  return {saved,ids,toggle,ready};
}
