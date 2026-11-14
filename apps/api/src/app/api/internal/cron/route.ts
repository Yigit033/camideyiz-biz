import {timingSafeEqual} from 'node:crypto';
import {db} from '@/lib/supabase';
import {performSync} from '@/lib/syncService';
import {publicError} from '@/lib/security';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
function authorized(request:Request):boolean {
  const secret=process.env.CRON_SECRET,auth=request.headers.get('authorization');
  if(!secret||secret.length<32||!auth?.startsWith('Bearer '))return false;
  const a=Buffer.from(auth.slice(7)),b=Buffer.from(secret);
  return a.length===b.length&&timingSafeEqual(a,b);
}
type Target={city_id:number;last_sync_at:string|null};
/**
 * Low-quota daily job. Select ONLY preapproved city IDs from the server database.
 * No user-request-triggered calls, and never auto-crawl every Turkish district.
 */
export async function GET(request:Request){
  if(!authorized(request))return publicError('unauthorized',401);
  try{
    const targets=await db<Target[]>('diyanet_sync_targets?select=city_id,last_sync_at&enabled=eq.true&order=last_sync_at.asc.nullsfirst&limit=6');
    if(!targets.length)return Response.json({status:'idle',reason:'no_approved_cities'},
      {headers:{'Cache-Control':'no-store'}});
    const istanbulDay=new Intl.DateTimeFormat('en-CA',{day:'2-digit',
      timeZone:'Europe/Istanbul'}).format(new Date());
    // A monthly call at each month start; weekly calls are otherwise sufficient
    // to refill rolling next-day coverage. Only six targets per daily invocation.
    const mode=Number(istanbulDay)<=2?'monthly':'weekly';
    const results=await Promise.allSettled(targets.map(async item=>{
      const outcome=await performSync(mode,item.city_id);
      if(outcome.status==='synced'){
        await db('diyanet_sync_targets?city_id=eq.'+item.city_id,{
          method:'PATCH',body:{last_sync_at:new Date().toISOString()},
          prefer:'return=minimal',
        });
      }
      return outcome;
    }));
    const succeeded=results.filter(x=>x.status==='fulfilled'&&x.value.status==='synced').length;
    const failed=results.filter(x=>x.status==='rejected').length;
    return Response.json({status:failed?'partial':'ok',checked:targets.length,synced:succeeded,failed},
      {headers:{'Cache-Control':'no-store'}});
  }catch{return publicError('cron_failed',503);}
}
