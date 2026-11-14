import {isSyncAuthorized,publicError,idNumber} from '@/lib/security';
import {performSync,type SyncMode} from '@/lib/syncService';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;

export async function POST(request:Request){
  if(!isSyncAuthorized(request))return publicError('unauthorized',401);
  let data:unknown;
  try{data=await request.json();}catch{return publicError('invalid_json',400);}
  if(!data||typeof data!=='object'||Array.isArray(data))return publicError('invalid_request',400);
  const {mode,stateId,cityId}=data as {mode?:unknown;stateId?:unknown;cityId?:unknown};
  if(mode!=='states'&&mode!=='cities'&&mode!=='weekly'&&mode!=='monthly')return publicError('invalid_mode',400);
  const id=mode==='states'?null:idNumber(String(mode==='cities'?stateId:cityId));
  if(mode!=='states'&&!id)return publicError('invalid_id',400);
  try{
    return Response.json(await performSync(mode as SyncMode,id),
      {headers:{'Cache-Control':'no-store'}});
  }catch{return publicError('sync_failed_or_credentials_not_configured',503);}
}
