/** Strict, pure server-side validation of owner-scheduled announcements.
 * A "draft" is never a broadcast; dispatch requires separate authorization.
 */
export const ANNOUNCEMENT_MAX_TITLE=80;
export const ANNOUNCEMENT_MAX_BODY=280;
export const ANNOUNCEMENT_MAX_FUTURE_DAYS=60;
export type ValidAnnouncement={
  title:string;body:string;scheduledAt:string;
};
export function isValidBroadcast(
  title:unknown,body:unknown,when:unknown,now=Date.now(),
):ValidAnnouncement|null{
  if(typeof title!=='string'||typeof body!=='string'||
    typeof when!=='string'||when.length>45||!Number.isFinite(now))return null;
  const a=title.trim(),b=body.trim();
  if(a.length<3||a.length>ANNOUNCEMENT_MAX_TITLE||
    b.length<3||b.length>ANNOUNCEMENT_MAX_BODY||
    /[\x00-\x08\x0B-\x1F\x7F]/.test(a+b))return null;
  // Explicit offset: Istanbul operator selects +03:00; never interpret a
  // bare 18:00 using the server's own timezone.
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(when))return null;
  const ms=Date.parse(when);
  if(!Number.isFinite(ms)||ms<now+5*60_000||
    ms>now+ANNOUNCEMENT_MAX_FUTURE_DAYS*86400_000)return null;
  return {title:a,body:b,scheduledAt:new Date(ms).toISOString()};
}
