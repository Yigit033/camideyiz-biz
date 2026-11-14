import {states} from '@/lib/cache';
import {publicError} from '@/lib/security';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
  try{
    const items=await states();
    return Response.json({source:'diyanet-awqat-salah',states:items},
      {headers:{'Cache-Control':'public, s-maxage=3600, stale-while-revalidate=3600'}});
  }catch{return publicError('location_directory_unavailable',503);}
}
