import 'server-only';
import {timingSafeEqual} from 'node:crypto';
export function isSyncAuthorized(request:Request):boolean {
  const secret=process.env.PRAYER_SYNC_SECRET;
  const given=request.headers.get('authorization');
  if(!secret||secret.length<32||!given?.startsWith('Bearer '))return false;
  const a=Buffer.from(given.slice(7));
  const b=Buffer.from(secret);
  return a.length===b.length&&timingSafeEqual(a,b);
}
export function publicError(message:string,status:number){
  return Response.json({error:message},{status,headers:{'Cache-Control':'no-store'}});
}
export function idNumber(raw:string|null):number|null {
  if(!raw||!/^[1-9]\d{0,7}$/.test(raw))return null;
  const n=Number(raw);return Number.isSafeInteger(n)?n:null;
}
