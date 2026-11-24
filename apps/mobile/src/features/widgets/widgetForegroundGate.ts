/** Lightweight Android widget health gate. No calendar/network engine imports.
 * The native AlarmManager and launcher handle intra-day transitions without
 * foreground React republishing on every launch. A periodic 6h refresh or a
 * damaged/mismatched calendar still gets the original verified JS publisher.
 */
export const FOREGROUND_REPUBLISH_INTERVAL_MS=6*60*60_000;
export const MIN_CALENDAR_COVERAGE_MS=24*60*60_000;
/** Bump when the published widget payload gains fields the launcher needs
 * (2: kerahet edges and the published Hijri date). */
export const WIDGET_PAYLOAD_REVISION=2;

type KerahatKeySource={mode:string;sunriseMinutes:number;
  preNoonMinutes:number;preSunsetMinutes:number};
/** What the native timeline was built from. A calendar published by an older
 * app, or with other kerahet settings, carries a different key and is
 * republished instead of waiting for the 6-hour refresh. */
export function widgetContentKey(kerahat:KerahatKeySource):string{
  return ['p'+WIDGET_PAYLOAD_REVISION,kerahat.mode,kerahat.sunriseMinutes,
    kerahat.preNoonMinutes,kerahat.preSunsetMinutes].join('|');
}

export type NativeWidgetSummary={
  supported:boolean;
  persisted:boolean;hasTimeline:boolean;lastReady:boolean;
  nativeCityId:number;activeCityId:number;
  lastSyncAt:number;calendarEndsAt:number;calendarSourceAt:number;
  lastError:string;lastTransferError:string;
  lastAppliedAt:number;nextAlarmAt:number;
  installedNext:number;installedDay:number;
  installedCompact?:number;installedFocus?:number;installedStrip?:number;
  installedMiniRing?:number;installedPremiumRing?:number;installedSlim?:number;
  installedSquareRing?:number;installedRow?:number;installedColumn?:number;
  calendarContentKey?:string;
};

export function widgetNeedsForegroundPublish(
  state:NativeWidgetSummary|null,cityId:number,now:number,contentKey?:string,
):boolean{
  if(!state)return true;
  if(cityId<=0||!Number.isFinite(now))return false;
  if(!state.supported||!state.persisted||!state.lastReady||!state.hasTimeline)
    return true;
  if(state.nativeCityId!==cityId||state.activeCityId!==cityId)return true;
  if(contentKey!==undefined&&state.calendarContentKey!==contentKey)return true;
  if(state.lastError||state.lastTransferError)return true;
  if(!Number.isFinite(state.calendarEndsAt)||
     state.calendarEndsAt<now+MIN_CALENDAR_COVERAGE_MS)return true;
  if(!Number.isFinite(state.calendarSourceAt)||
     state.calendarSourceAt<=0||state.calendarSourceAt>now+60_000)return true;
  if(!Number.isFinite(state.lastSyncAt)||state.lastSyncAt<=0||
     state.lastSyncAt>now+60_000)return true;
  return now-state.lastSyncAt>=FOREGROUND_REPUBLISH_INTERVAL_MS;
}
