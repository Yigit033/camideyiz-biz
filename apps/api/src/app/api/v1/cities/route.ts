import {cities,states} from '@/lib/cache';
import {idNumber,publicError} from '@/lib/security';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  const stateId=idNumber(new URL(request.url).searchParams.get('stateId'));
  if(!stateId)return publicError('invalid_state_id',400);
  try{
    const all=await states();
    if(!all.some(item=>item.id===stateId))return publicError('unknown_state',404);
    return Response.json({source:'diyanet-awqat-salah',stateId,cities:await cities(stateId)},
      {headers:{'Cache-Control':'public, s-maxage=3600, stale-while-revalidate=3600'}});
  }catch{return publicError('location_directory_unavailable',503);}
}
