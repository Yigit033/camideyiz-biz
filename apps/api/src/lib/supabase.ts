import 'server-only';

/** Service-role operations MUST run only in this API app. Client keys must never be shipped. */
function settings(){
  const host=process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!host||!key||!/^https:\/\//.test(host))throw new Error('Cache backend unavailable');
  return {host:host.replace(/\/+$/,''),key};
}
export async function db<T>(path:string,options:{method?:'GET'|'POST'|'PATCH';body?:unknown;prefer?:string}={}):Promise<T>{
  const {host,key}=settings();
  if(!/^[a-zA-Z_][a-zA-Z_0-9]*(?:[/?].*)?$/.test(path))throw new Error('Invalid DB path');
  const response=await fetch(host+'/rest/v1/'+path,{
    method:options.method??'GET',
    headers:{
      apikey:key,Authorization:'Bearer '+key,
      'Content-Type':'application/json','Accept':'application/json',
      ...(options.prefer?{Prefer:options.prefer}:{}),
    },
    body:options.body===undefined?undefined:JSON.stringify(options.body),
    cache:'no-store',signal:AbortSignal.timeout(13000),
  });
  if(!response.ok)throw new Error('Prayer cache request failed: '+response.status);
  // RPC boolean returns a JSON primitive; Prefer:return=minimal returns no body.
  const content=await response.text();
  return (content?JSON.parse(content):null) as T;
}
export const dbReady=()=>Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY);
