import {db} from '@/lib/supabase';
import {
  announcementsEnabled,authorizedWith,ANNOUNCEMENT_KIND,
  ANNOUNCEMENT_CHANNEL,jsonError,jsonNoStore,
} from '@/lib/announcements';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;

type DueDelivery={
  delivery_id:number;announcement_id:string;title:string;
  body:string;expo_token:string;
};
type ExpoTicket={status?:unknown;id?:unknown;details?:{error?:unknown};message?:unknown};
type Finish={id:number;status:'accepted'|'retry'|'failed';ticket?:string;error?:string};

/** Called by a trusted external 1–5 minute scheduler. Never by the mobile
 * client. Uses durable DB leases to protect against concurrent cron runs.
 * This is provider acceptance, not proof of delivery to a device.
 */
export async function GET(request:Request){
  if(!authorizedWith(request,'CRON_SECRET'))return jsonError('unauthorized',401);
  if(!announcementsEnabled())return jsonError('announcements_not_configured',503);
  let claimed=0;
  let materialized=0;
  let accepted=0;
  let rejected=0;
  try{
    materialized=await db<number>('rpc/cb_push_materialize_due',{
      method:'POST',body:{p_limit:2},
    });
    const jobs=await db<DueDelivery[]>('rpc/cb_push_claim_deliveries',{
      method:'POST',body:{p_limit:80},
    });
    claimed=jobs.length;
    if(!claimed){
      // Flush stale exhausted leases, and update completed broadcast totals.
      await db<number>('rpc/cb_push_finish_deliveries',{
        method:'POST',body:{p_results:[]},
      });
      return jsonNoStore({status:'idle',materialized,claimed:0});
    }
    const payload=jobs.map(x=>({
      to:x.expo_token,
      title:x.title,
      body:x.body,
      sound:'default',
      priority:'normal',
      channelId:ANNOUNCEMENT_CHANNEL,
      ttl:24*3600,
      data:{kind:ANNOUNCEMENT_KIND,announcementId:x.announcement_id},
    }));
    let finished:Finish[]=jobs.map(x=>({
      id:x.delivery_id,status:'retry',error:'provider_unavailable',
    }));
    try{
      const headers:Record<string,string>={
        'Content-Type':'application/json',
        Accept:'application/json',
        'Accept-Encoding':'gzip, deflate',
      };
      const token=process.env.CB_EXPO_ACCESS_TOKEN;
      if(token)headers.Authorization='Bearer '+token;
      const response=await fetch('https://exp.host/--/api/v2/push/send',{
        method:'POST',headers,body:JSON.stringify(payload),
        signal:AbortSignal.timeout(18_000),cache:'no-store',
      });
      if(response.ok){
        const raw:unknown=await response.json();
        const data=(raw&&typeof raw==='object'&&
          Array.isArray((raw as {data?:unknown}).data))
          ?(raw as {data:ExpoTicket[]}).data:null;
        if(data&&data.length===jobs.length){
          finished=data.map((ticket,i)=>{
            const id=jobs[i].delivery_id;
            if(ticket.status==='ok'&&typeof ticket.id==='string'&&
              ticket.id.length<150){
              accepted++;
              return {id,status:'accepted',ticket:ticket.id} as Finish;
            }
            rejected++;
            const kind=typeof ticket.details?.error==='string'
              ?ticket.details.error:'provider_rejected';
            return {id,status:kind==='DeviceNotRegistered'?'failed':'retry',
              error:kind.slice(0,80)} as Finish;
          });
        }
      }
    }catch{/* The DB lease will retry; no false delivery claim. */}
    await db<number>('rpc/cb_push_finish_deliveries',{
      method:'POST',body:{p_results:finished},
    });
    return jsonNoStore({
      status:accepted?'accepted_by_provider':rejected?'partly_rejected':'retry_scheduled',
      materialized,claimed,accepted,rejected,
      // No tokens, no message body, no subscriber identifiers in cron result.
    });
  }catch{
    return jsonError('dispatch_unavailable_retry_later',503);
  }
}
