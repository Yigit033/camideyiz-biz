import {googlePlacesKey,allowPlacesRequest} from '@/lib/googleQuota';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  const name=new URL(request.url).searchParams.get('name')??'';
  if(name.length>1100||
    !/^places\/[A-Za-z0-9_-]{5,250}\/photos\/[A-Za-z0-9_-]{8,1000}$/.test(name))
    return Response.json({error:'invalid_photo_reference'},{status:400});
  const key=googlePlacesKey();
  if(!key)return Response.json({error:'google_places_not_configured'},{status:503});
  if(!allowPlacesRequest(request,2))return Response.json({error:'query_rate_limited'},{status:429});
  try{
    const source=await fetch('https://places.googleapis.com/v1/'+name+'/media?maxWidthPx=1000&skipHttpRedirect=true',{
      headers:{'X-Goog-Api-Key':key},cache:'no-store',signal:AbortSignal.timeout(9000),
    });
    if(!source.ok)return Response.json({error:'photo_unavailable'},{status:502});
    const data=await source.json() as {photoUri?:unknown};
    if(typeof data.photoUri!=='string')throw new Error('Missing photo URL');
    const url=new URL(data.photoUri);
    if(url.protocol!=='https:'||
      !(url.hostname==='lh3.googleusercontent.com'||url.hostname.endsWith('.googleusercontent.com')))
      throw new Error('Unexpected Google photo host');
    return new Response(null,{status:302,headers:{Location:url.toString(),'Cache-Control':'private, no-store'}});
  }catch{return Response.json({error:'photo_unavailable'},{status:503});}
}
