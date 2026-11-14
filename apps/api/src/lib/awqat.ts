import 'server-only';
import {parseDiyanetList,parsePlace,parseDiyanetDay,type VerifiedPrayerDay,type PublicPlace} from '@camideyiz/core';

/** All Diyanet credentials and token rotation are exclusively server-side. */
const BASE='https://awqatsalah.diyanet.gov.tr';
type Session={token:string;refresh:string;expiresAt:number};
let session:Session|null=null;
let pending:Promise<string>|null=null;
function credentials(){
  const email=process.env.DIYANET_EMAIL, password=process.env.DIYANET_PASSWORD;
  if(!email||!password)throw new Error('Diyanet credentials not configured');
  return {email,password};
}
async function send(path:string,init:RequestInit={}):Promise<unknown>{
  const response=await fetch(BASE+path,{...init,headers:{Accept:'application/json',...(init.headers??{})},
    cache:'no-store',signal:AbortSignal.timeout(18000)});
  if(!response.ok)throw new Error('Diyanet upstream HTTP '+response.status);
  return response.json();
}
function decodeSession(response:unknown):Session {
  if(!response||typeof response!=='object')throw new Error('Bad authentication response');
  const envelope=response as {success?:boolean;data?:{accessToken?:string;refreshToken?:string}};
  if(envelope.success!==true||typeof envelope.data?.accessToken!=='string'||
    typeof envelope.data.refreshToken!=='string')throw new Error('Authentication rejected');
  return {token:envelope.data.accessToken,refresh:envelope.data.refreshToken,
    // Access token official validity 45m. Refresh 7 days (rotating).
    expiresAt:Date.now()+40*60*1000};
}
async function acquire():Promise<string>{
  if(session && session.expiresAt>Date.now()+60_000)return session.token;
  if(session?.refresh){
    try{
      const body=await send('/Auth/RefreshToken/'+encodeURIComponent(session.refresh));
      session=decodeSession(body);return session.token;
    }catch{session=null;}
  }
  const body=await send('/Auth/Login',{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify(credentials())});
  session=decodeSession(body);return session.token;
}
async function token():Promise<string>{
  if(!pending)pending=acquire().finally(()=>{pending=null;});
  return pending;
}
export async function awqatGet(path:string):Promise<unknown>{
  if(!/^\/api\/(?:Place|PrayerTime|Quota)\//.test(path)||path.includes('..'))
    throw new Error('Disallowed Diyanet endpoint');
  const access=await token();
  try{
    return await send(path,{headers:{Authorization:'Bearer '+access}});
  }catch(error){
    if(!(error instanceof Error)||!error.message.endsWith('401'))throw error;
    session=null;
    return send(path,{headers:{Authorization:'Bearer '+await token()}});
  }
}
export async function statesOfTurkey():Promise<Array<{id:number;name:string;countryId:number}>>{
  const countries=parseDiyanetList(await awqatGet('/api/Place/Countries'));
  const turkey=countries.find(row=>String(row.code??'').toUpperCase()==='TURKEY'||
    ['TÜRKİYE','TURKIYE'].includes(String(row.name??'').toLocaleUpperCase('tr-TR')));
  if(!turkey)throw new Error('Country Türkiye missing in official directory');
  const countryId=parsePlace(turkey).id;
  const states=parseDiyanetList(await awqatGet('/api/Place/States/'+countryId));
  return states.map(row=>({...parsePlace(row),countryId}));
}
export async function citiesOfState(stateId:number):Promise<Array<PublicPlace>>{
  const rows=parseDiyanetList(await awqatGet('/api/Place/Cities/'+stateId));
  return rows.map(r=>parsePlace(r,stateId));
}
export async function monthlyDays(cityId:number,displayName:string):Promise<VerifiedPrayerDay[]>{
  const fetched=new Date().toISOString();
  const rows=parseDiyanetList(await awqatGet('/api/PrayerTime/Monthly/'+cityId));
  if(rows.length<1||rows.length>35)throw new Error('Unexpected month length from Diyanet');
  const parsed=rows.map(row=>parseDiyanetDay(row,cityId,displayName,fetched));
  const unique=new Set(parsed.map(x=>x.dateISO));
  if(unique.size!==parsed.length)throw new Error('Duplicate daily prayer date');
  return parsed;
}
