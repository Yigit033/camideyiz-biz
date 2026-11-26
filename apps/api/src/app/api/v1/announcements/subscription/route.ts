import {createHash} from 'node:crypto';
import {db} from '@/lib/supabase';
import {
  announcementsEnabled,validExpoToken,validInstallationId,
  validInstallSecret,trustedIpHash,jsonError,jsonNoStore,
} from '@/lib/announcements';
export const runtime='nodejs';
export const dynamic='force-dynamic';

/** No user accounts required: this endpoint only registers an anonymous
 * opt-in device. Existing records require a 256-bit per-installation secret.
 * Push tokens and secrets are never returned to clients.
 */
export async function POST(request:Request){
  if(!announcementsEnabled())return jsonError('announcements_not_configured',503);
  if(Number(request.headers.get('content-length')??0)>2048)
    return jsonError('request_too_large',413);
  const ipHash=trustedIpHash(request);
  if(!ipHash)return jsonError('registration_unavailable',503);
  let value:unknown;
  try{
    const data=await request.text();
    if(data.length>2048)return jsonError('request_too_large',413);
    value=JSON.parse(data) as unknown;
  }catch{return jsonError('invalid_json',400);}
  if(!value||typeof value!=='object'||Array.isArray(value))
    return jsonError('invalid_request',400);
  const data=value as Record<string,unknown>;
  if(!validInstallationId(data.installationId)||!validInstallSecret(data.secret)||
    !validExpoToken(data.expoPushToken)||
    (data.platform!=='android'&&data.platform!=='ios')||
    typeof data.enabled!=='boolean')return jsonError('invalid_subscription',400);
  try{
    const slot=await db<boolean>('rpc/cb_push_take_registration_slot',{
      method:'POST',body:{p_ip_hash:ipHash,p_max:15},
    });
    if(!slot)return jsonError('too_many_requests',429);
    const hashed=createHash('sha256').update(data.secret).digest('hex');
    const ok=await db<boolean>('rpc/cb_push_set_subscription',{
      method:'POST',
      body:{p_id:data.installationId,p_secret_hash:hashed,
        p_expo_token:data.expoPushToken,p_platform:data.platform,p_enabled:data.enabled},
    });
    if(!ok)return jsonError('subscription_conflict',409);
    return jsonNoStore({enabled:data.enabled,updated:true});
  }catch{return jsonError('subscription_service_unavailable',503);}
}
