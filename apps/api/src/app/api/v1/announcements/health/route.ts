import {db} from '@/lib/supabase';
import {announcementsEnabled,jsonError,jsonNoStore} from '@/lib/announcements';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
  if(!announcementsEnabled())return jsonError('announcements_not_configured',503);
  try{
    await db<unknown[]>('cb_announcements?select=id&limit=0');
    return jsonNoStore({status:'ready'});
  }catch{return jsonError('announcements_database_unavailable',503);}
}
