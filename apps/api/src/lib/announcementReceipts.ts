import 'server-only';
import {db} from './supabase';
type Ticket={delivery_id:number;ticket_id:string};
type Receipt={status?:unknown;details?:{error?:unknown}};
export type ReceiptPollResult={requested:number;ok:number;error:number;waiting:number};

/** Expo receipts can indicate APNs/FCM accepted or rejected a ticket, NOT
 * proof that the phone displayed the notification or a user read it.
 */
export async function pollPushReceipts():Promise<ReceiptPollResult>{
  const due=await db<Ticket[]>('rpc/cb_push_claim_receipts',{
    method:'POST',body:{p_limit:80},
  });
  const report={requested:due.length,ok:0,error:0,waiting:0};
  if(!due.length)return report;
  const headers:Record<string,string>={
    'Content-Type':'application/json',Accept:'application/json',
  };
  if(process.env.CB_EXPO_ACCESS_TOKEN)
    headers.Authorization='Bearer '+process.env.CB_EXPO_ACCESS_TOKEN;
  const response=await fetch('https://exp.host/--/api/v2/push/getReceipts',{
    method:'POST',headers,body:JSON.stringify({ids:due.map(x=>x.ticket_id)}),
    signal:AbortSignal.timeout(12_000),cache:'no-store',
  });
  if(!response.ok)throw Error('Push receipt service error');
  const raw:unknown=await response.json();
  if(!raw||typeof raw!=='object'||!('data' in raw)||
    !raw.data||typeof raw.data!=='object'||Array.isArray(raw.data))
    throw Error('Invalid push receipt response');
  const records=raw.data as Record<string,Receipt>;
  const results=due.map(ticket=>{
    const receipt=records[ticket.ticket_id];
    if(!receipt||receipt.status!=='ok'&&receipt.status!=='error'){
      report.waiting++;
      return {id:ticket.delivery_id,status:'pending'};
    }
    if(receipt.status==='ok'){
      report.ok++;
      return {id:ticket.delivery_id,status:'ok'};
    }
    report.error++;
    return {id:ticket.delivery_id,status:'error',
      error:typeof receipt.details?.error==='string'
        ?receipt.details.error.slice(0,80):'provider_rejected'};
  });
  await db<number>('rpc/cb_push_finish_receipts',{
    method:'POST',body:{p_results:results},
  });
  return report;
}
