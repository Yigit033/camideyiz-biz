import 'server-only';
/**
 * Best-effort, process-local throttle for staging. Serverless instances do not
 * share state! Production must use a distributed limiter and app attestation.
 */
const buckets=new Map<string,{started:number;count:number}>();
export function googlePlacesKey():string|null{
  if(process.env.GOOGLE_PLACES_API_ENABLED!=='true')return null;
  const key=process.env.GOOGLE_PLACES_API_KEY?.trim();
  return key||null;
}
export function allowPlacesRequest(request:Request,cost=1):boolean{
  const addr=(request.headers.get('x-real-ip')||
    request.headers.get('x-forwarded-for')?.split(',')[0]||'shared').slice(0,80);
  if(buckets.size>2000)buckets.clear();
  const now=Date.now(),entry=buckets.get(addr);
  if(!entry||now-entry.started>60_000){
    buckets.set(addr,{started:now,count:cost});return true;
  }
  if(entry.count+cost>18)return false;
  entry.count+=cost;return true;
}
