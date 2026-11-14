import AsyncStorage from '@react-native-async-storage/async-storage';
import {commonsTitle} from '@camideyiz/core';
const KEY='@camideyiz/commons-photo/';
export type CommonsPhoto={
  url:string;title:string;credit:string;license:string;descriptionUrl:string;licenseUrl:string|null;
};
function cleanHtml(value:string):string{
  return value.replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"')
    .replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim().slice(0,300);
}
function hostAllowed(raw:unknown):raw is string{
  if(typeof raw!=='string')return false;
  try{const u=new URL(raw);return u.protocol==='https:'&&
    (u.hostname==='upload.wikimedia.org'||u.hostname.endsWith('.wikimedia.org'));}
  catch{return false;}
}
export async function loadCommonsPhoto(file:unknown):Promise<CommonsPhoto|null>{
  const title=commonsTitle(file);
  if(!title)return null;
  const key=KEY+title;
  try{
    const old=await AsyncStorage.getItem(key);
    if(old){const parsed=JSON.parse(old) as {stamp:number;photo:CommonsPhoto|null};
      if(Date.now()-parsed.stamp<24*60*60*1000)return parsed.photo;}
  }catch{/* ignore corrupted entry */}
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),10000);
  try{
    const q=new URLSearchParams({
      action:'query',format:'json',prop:'imageinfo',iiprop:'url|extmetadata',
      iiurlwidth:'900',titles:title,origin:'*',
    });
    const res=await fetch('https://commons.wikimedia.org/w/api.php?'+q.toString(),{signal:ctrl.signal});
    if(!res.ok)return null;
    const body=await res.json() as {query?:{pages?:Record<string,{
      title?:string;imageinfo?:Array<{
        thumburl?:string;descriptionurl?:string;extmetadata?:Record<string,{value?:string}>;
      }>;
    }>}};
    const entry=Object.values(body.query?.pages??{})[0];
    const info=entry?.imageinfo?.[0];
    const meta=info?.extmetadata??{};
    const license=cleanHtml(meta.LicenseShortName?.value??'');
    // Do not display photos with unknown licensing or missing attribution.
    const allowed=/(?:CC\s*BY|CC0|public domain|PD-|CC\s*BY-SA)/i.test(license);
    const credit=cleanHtml(meta.Artist?.value??meta.Credit?.value??'');
    if(!allowed||!credit||!hostAllowed(info?.thumburl)||
      !hostAllowed(info?.descriptionurl))return null;
    const link=meta.LicenseUrl?.value;
    const photo:CommonsPhoto={
      url:info.thumburl,title,credit,license,descriptionUrl:info.descriptionurl,
      licenseUrl:hostAllowed(link)?link:null,
    };
    AsyncStorage.setItem(key,JSON.stringify({stamp:Date.now(),photo})).catch(()=>undefined);
    return photo;
  }catch{return null;
  }finally{clearTimeout(timer);}
}
