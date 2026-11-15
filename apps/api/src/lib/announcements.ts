import 'server-only';
import {createHmac,timingSafeEqual} from 'node:crypto';

export const ANNOUNCEMENT_KIND='camideyiz-announcement-v1';
export const ANNOUNCEMENT_CHANNEL='duyurular-v1';
export const API_NO_CACHE={'Cache-Control':'no-store'} as const;
const TOKEN_PATTERN=/^(?:ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]{10,220}\]$/;
const UUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECRET_PATTERN=/^[0-9a-f]{64}$/i;

export function announcementsEnabled():boolean{
  // Publishing and device registration both fail closed unless explicitly
  // switched on in the server environment AFTER migration + push credentials.
  return process.env.CB_ANNOUNCEMENTS_ENABLED==='true';
}
export function authorizedWith(request:Request,environmentKey:string):boolean{
  const configured=process.env[environmentKey];
  const auth=request.headers.get('authorization');
  if(!configured||configured.length<48||!auth?.startsWith('Bearer '))return false;
  const supplied=Buffer.from(auth.slice(7)),expected=Buffer.from(configured);
  return supplied.length===expected.length&&timingSafeEqual(supplied,expected);
}
export function validExpoToken(token:unknown):token is string{
  return typeof token==='string'&&token.length<=256&&TOKEN_PATTERN.test(token);
}
export function validInstallationId(id:unknown):id is string{
  return typeof id==='string'&&UUID_PATTERN.test(id);
}
export function validInstallSecret(secret:unknown):secret is string{
  return typeof secret==='string'&&SECRET_PATTERN.test(secret);
}
export function trustedIpHash(request:Request):string|null{
  const pepper=process.env.CB_PUSH_IP_HASH_SECRET;
  // Never trust arbitrary client-provided X-Forwarded-For. Vercel overwrites
  // X-Vercel-Forwarded-For at the edge; require it for registration.
  const source=request.headers.get('x-vercel-forwarded-for');
  if(!pepper||pepper.length<32||!source||source.length>70||
    !/^[0-9a-fA-F:.]+$/.test(source))return null;
  return createHmac('sha256',pepper).update(source).digest('hex');
}
export function jsonNoStore(body:unknown,status=200):Response{
  return Response.json(body,{status,headers:API_NO_CACHE});
}
export function jsonError(error:string,status:number):Response{
  return jsonNoStore({error},status);
}
export function isValidBroadcast(title:unknown,body:unknown,when:unknown,now=Date.now()):
  {title:string;body:string;scheduledAt:string}|null{
  if(typeof title!=='string'||typeof body!=='string'||
    typeof when!=='string'||when.length>45)return null;
  const a=title.trim(),b=body.trim();
  if(a.length<3||a.length>80||b.length<3||b.length>280||
    /[\x00-\x08\x0B-\x1F\x7F]/.test(a+b))return null;
  // Explicit timezone required; never accept a server-local implicit date.
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(when))return null;
  const ms=Date.parse(when);
  if(!Number.isFinite(ms)||ms<now+5*60_000||ms>now+60*86400_000)return null;
  return {title:a,body:b,scheduledAt:new Date(ms).toISOString()};
}
