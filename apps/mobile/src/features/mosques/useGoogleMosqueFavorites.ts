import AsyncStorage from '@react-native-async-storage/async-storage';
import {useEffect,useMemo,useRef,useState} from 'react';
import {validGooglePlaceId} from '@camideyiz/core';
const KEY='@camideyiz/google-mosque-favorite-place-ids/v1';
/** Google Maps policies permit persistent Place IDs, not name/address/coordinates.
 * Save only IDs. Re-fetch detail metadata on demand after reopening the app.
 */
export function useGoogleMosqueFavorites(){
  const [items,setItems]=useState<string[]>([]);
  const ready=useRef(false);
  useEffect(()=>{
    let active=true;
    AsyncStorage.getItem(KEY).then(value=>{
      if(!active)return;
      try{
        const raw:unknown=JSON.parse(value??'[]');
        if(Array.isArray(raw))setItems(raw.filter(validGooglePlaceId).slice(0,100));
      }catch{/* fall back to empty */}
    }).catch(()=>undefined).finally(()=>{ready.current=true;});
    return ()=>{active=false;};
  },[]);
  const ids=useMemo(()=>new Set(items),[items]);
  function toggle(id:string){
    if(!validGooglePlaceId(id))return;
    setItems(previous=>{
      const next=previous.includes(id)?previous.filter(x=>x!==id):[id,...previous].slice(0,100);
      AsyncStorage.setItem(KEY,JSON.stringify(next)).catch(()=>undefined);
      return next;
    });
  }
  return {ids,items,toggle};
}
