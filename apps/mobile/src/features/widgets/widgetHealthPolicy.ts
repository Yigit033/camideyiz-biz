/**
 * Pure Widget Engine 4.0 policy: a HEADLESS periodic task should not import the
 * heavyweight prayer/calendar engine just to redraw a healthy native widget.
 * Native status is a persisted published-calendar receipt, NOT launcher pixels.
 * Deliberately no React Native, Expo, AsyncStorage, clock/GPS or network import.
 */
export const HEADLESS_RECHECK_MS=2*60*60_000;
export const HEADLESS_COVERAGE_MS=24*60*60_000;
export const HEADLESS_MAX_SOURCE_AGE_MS=16*24*60*60_000;

export type HeadlessNativeHealth={
  supported?:boolean;persisted?:boolean;hasTimeline?:boolean;lastReady?:boolean;
  nativeCityId?:number;activeCityId?:number;
  lastError?:string;lastTransferError?:string;
  calendarSourceAt?:number;calendarEndsAt?:number;lastSyncAt?:number;
  nextAlarmAt?:number;
  installedNext?:number;installedDay?:number;
  installedCompact?:number;installedFocus?:number;installedStrip?:number;
  installedMiniRing?:number;installedPremiumRing?:number;installedSlim?:number;
};

export function shouldSkipWidgetHeadlessRefresh(
  input:unknown,now:number,
):boolean{
  if(!input||typeof input!=='object'||Array.isArray(input)||
     !Number.isFinite(now))return false;
  const v=input as HeadlessNativeHealth;
  if(v.supported!==true||v.persisted!==true||v.hasTimeline!==true||
     v.lastReady!==true||v.lastError!==''||v.lastTransferError!=='')return false;
  if(!Number.isSafeInteger(v.activeCityId)||!v.activeCityId||
     v.activeCityId!==v.nativeCityId)return false;
  const counts=[v.installedNext,v.installedDay,v.installedCompact,v.installedFocus,
    v.installedStrip,v.installedMiniRing,v.installedPremiumRing,v.installedSlim];
  if(counts.some(n=>n!==undefined&&(!Number.isSafeInteger(n)||n<0))||
     counts.reduce<number>((sum,n)=>sum+(n??0),0)<1)return false;
  const source=v.calendarSourceAt,updated=v.lastSyncAt,end=v.calendarEndsAt;
  const next=v.nextAlarmAt;
  if(typeof source!=='number'||typeof updated!=='number'||
     typeof end!=='number'||typeof next!=='number'||
     !Number.isFinite(source)||!Number.isFinite(updated)||
     !Number.isFinite(end)||!Number.isFinite(next))return false;
  if(source<=0||source>now+60_000||now-source>HEADLESS_MAX_SOURCE_AGE_MS||
     updated<=0||updated>now+60_000||now-updated>=HEADLESS_RECHECK_MS||
     end<=now+HEADLESS_COVERAGE_MS||
     end>source+17*24*60*60_000||next<=now||next>end)return false;
  return true;
}
