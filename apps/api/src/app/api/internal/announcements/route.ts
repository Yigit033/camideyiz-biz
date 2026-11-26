import {randomUUID} from 'node:crypto';
import {db} from '@/lib/supabase';
import {
  announcementsEnabled,authorizedWith,isValidBroadcast,validInstallationId,
  jsonError,jsonNoStore,
} from '@/lib/announcements';
export const runtime='nodejs';
export const dynamic='force-dynamic';

type Announcement={
  id:string;title:string;body:string;scheduled_at:string;status:string;
  created_at:string;accepted_count:number;failed_count:number;
};
const auth=(request:Request)=>authorizedWith(request,'CB_ANNOUNCEMENT_ADMIN_SECRET');

export async function GET(request:Request){
  if(!auth(request))return jsonError('unauthorized',401);
  if(!announcementsEnabled())return jsonError('announcements_not_configured',503);
  try{
    const rows=await db<Announcement[]>('cb_announcements?select=id,title,body,scheduled_at,status,created_at,accepted_count,failed_count&order=created_at.desc&limit=40');
    return jsonNoStore({items:rows});
  }catch{return jsonError('announcement_database_unavailable',503);}
}
/** Step 1: create a DRAFT. Never implicitly schedule or send merely because
 * an editor hits Save. The owner must explicitly approve afterwards.
 */
export async function POST(request:Request){
  if(!auth(request))return jsonError('unauthorized',401);
  if(!announcementsEnabled())return jsonError('announcements_not_configured',503);
  let data:unknown;
  try{
    const raw=await request.text();
    if(raw.length>1500)return jsonError('request_too_large',413);
    data=JSON.parse(raw);
  }catch{return jsonError('invalid_json',400);}
  if(!data||typeof data!=='object'||Array.isArray(data))
    return jsonError('invalid_announcement',400);
  const v=data as Record<string,unknown>;
  const input=isValidBroadcast(v.title,v.body,v.scheduledAt);
  if(!input)return jsonError('invalid_announcement_or_time_range',400);
  const id=randomUUID();
  try{
    const rows=await db<Announcement[]>('cb_announcements',{
      method:'POST',prefer:'return=representation',
      body:{id,title:input.title,body:input.body,
        scheduled_at:input.scheduledAt,status:'draft'},
    });
    return jsonNoStore({item:rows?.[0]??{id,status:'draft'}},201);
  }catch{return jsonError('cannot_save_draft',503);}
}
/** Step 2: explicit approval or cancellation. No editing accepted jobs or
 * "send now" backdoors; scheduling cannot be backdated.
 */
export async function PATCH(request:Request){
  if(!auth(request))return jsonError('unauthorized',401);
  if(!announcementsEnabled())return jsonError('announcements_not_configured',503);
  let data:unknown;
  try{data=await request.json();}
  catch{return jsonError('invalid_json',400);}
  if(!data||typeof data!=='object'||Array.isArray(data))
    return jsonError('invalid_request',400);
  const v=data as Record<string,unknown>;
  if(!validInstallationId(v.id)||
    (v.action!=='approve'&&v.action!=='cancel'))
    return jsonError('invalid_action',400);
  try{
    const found=await db<Announcement[]>('cb_announcements?select=id,scheduled_at,status&id=eq.'+v.id+'&limit=1');
    const current=found[0];
    if(!current)return jsonError('not_found',404);
    if(v.action==='approve'){
      if(current.status!=='draft')return jsonError('not_a_draft',409);
      if(Date.parse(current.scheduled_at)<Date.now()+120_000)
        return jsonError('time_too_close_choose_new_draft',409);
    }else if(current.status!=='draft'&&current.status!=='scheduled')
      return jsonError('already_processing_or_completed',409);
    const target=v.action==='approve'?'scheduled':'cancelled';
    const rows=await db<Announcement[]>(
      'cb_announcements?select=id,status,scheduled_at&id=eq.'+v.id+
      '&status=eq.'+current.status,
      {method:'PATCH',prefer:'return=representation',
        body:{status:target,updated_at:new Date().toISOString()}},
    );
    if(!rows.length)return jsonError('already_modified',409);
    return jsonNoStore({item:rows[0]});
  }catch{return jsonError('announcement_update_failed',503);}
}
