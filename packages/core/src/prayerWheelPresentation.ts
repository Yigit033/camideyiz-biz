import type {RestrictionWindow} from './timeline.ts';
import {timeToMinutes,type PrayerTime} from './prayer.ts';
import {clockSecondsToVisualAngle} from './visualDial.ts';

/** The clock and its prayer name share the exact beginning separator.
 * A separate prayer icon is centered angularly within its own coloured wedge.
 * Geometry is computed on the same 360-unit canvas as the wheel: no drifting
 * labels when the user rotates repeatedly or the date/location changes.
 */
export function prayerSectorLabelAngle(from:number,to:number):number{
  if(!Number.isFinite(from)||!Number.isFinite(to)||
    from<0||to>360||to<=from)throw new RangeError('Invalid dial sector');
  return (from+to)/2;
}

/** The coloured annular band occupies radii 106.5..171.5.
 * Both the clock/name badge on its dark separator and the icon in its sector
 * occupy the exact middle radius (139), rather than clustering at either rim.
 * 35x27 + 14x14 boxes remain distinct even in ~20-degree Akşam wedges.
 */
export function prayerSectorVisualLayout(from:number,to:number){
  const middle=prayerSectorLabelAngle(from,to);
  const narrow=to-from<30;
  const bandMiddle=(106.5+171.5)/2;
  return {
    labelAngle:middle,
    labelRadius:bandMiddle,
    labelWidth:14,
    labelHeight:14,
    iconSize:14,
    fontSize:narrow?8.2:8.7,
    clockAngle:from,
    clockRadius:bandMiddle,
    clockWidth:35,
    clockHeight:27,
  };
}

/** Keep small HH:MM and prayer captions legible on their *exact* sector
 * colour, in both themes. Choose the foreground by WCAG 2.1 contrast rather
 * than by assumed darkness or arbitrary translucent text overlays.
 */
export const PRAYER_BADGE_DARK_INK='#081A26';
export const PRAYER_BADGE_LIGHT_INK='#FFFFFF';
export function prayerBadgeForeground(backgroundHex:string):string{
  if(!/^#[0-9a-f]{6}$/i.test(backgroundHex))
    throw new RangeError('Expected six-digit sector colour');
  const luminance=(hex:string)=>{
    const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255)
      .map(x=>x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4));
    return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
  };
  const bg=luminance(backgroundHex);
  const dark=luminance(PRAYER_BADGE_DARK_INK);
  const light=luminance(PRAYER_BADGE_LIGHT_INK);
  const darkContrast=(Math.max(bg,dark)+.05)/(Math.min(bg,dark)+.05);
  const lightContrast=(Math.max(bg,light)+.05)/(Math.min(bg,light)+.05);
  return darkContrast>=lightContrast?PRAYER_BADGE_DARK_INK:PRAYER_BADGE_LIGHT_INK;
}

export type CurrentPrayerArc={
  sectorIndex:number;
  from:number;
  to:number;
  progressAngle:number;
  progress:number;
};

/** The current clock-time progress lives within ONE prayer wedge, rather than
 * an unrelated 0..360° decorative circle. The night wedge uses tomorrow's
 * actual İmsak clock and, after midnight, yesterday's actual Yatsı clock when
 * those verified daily schedules are available.
 *
 * Geometry still uses the existing 24h visual dial wedges; only the marker's
 * fraction of the night wedge is day-aware. Missing neighbouring days use
 * same-day times instead of making up tomorrow's schedule.
 */
export function currentPrayerArc(
  secondsOfDay:number,
  times:readonly PrayerTime[],
  sectors:readonly {from:number;to:number}[],
  previousYatsiTime?:string|null,
  nextImsakTime?:string|null,
):CurrentPrayerArc|null{
  if(times.length===0)return null;
  const angle=clockSecondsToVisualAngle(secondsOfDay,times,sectors);
  const index=sectors.findIndex(s=>angle>=s.from&&angle<s.to);
  if(index<0)throw new RangeError('Current clock has no prayer sector');
  const sector=sectors[index];
  let ratio=(angle-sector.from)/(sector.to-sector.from);
  if(times[index].key==='yatsi'){
    const first=timeToMinutes(times[0].time)*60;
    const last=timeToMinutes(times[index].time)*60;
    const afterYatsi=secondsOfDay>=last;
    const start=afterYatsi?last
      :(previousYatsiTime?timeToMinutes(previousYatsiTime)*60:last);
    const end=afterYatsi
      ?(nextImsakTime?timeToMinutes(nextImsakTime)*60:first)
      :first;
    const total=86400-start+end;
    const elapsed=afterYatsi?secondsOfDay-start:86400-start+secondsOfDay;
    if(total<=0)throw new RangeError('Invalid overnight prayer period');
    ratio=elapsed/total;
  }
  ratio=Math.max(0,Math.min(1,ratio));
  return {sectorIndex:index,from:sector.from,to:sector.to,
    progressAngle:sector.from+(sector.to-sector.from)*ratio,progress:ratio};
}

export type KerahatRingState='inactive'|'approaching'|'active';
export type KerahatRingWindow=RestrictionWindow&{
  state:KerahatRingState;
};
/** A restrained 20-minute notice before an *approximate* kerahat window.
 * Half-open [start,end) boundaries prevent false active highlights.
 */
export const KERAHAT_APPROACH_SECONDS=20*60;
export function kerahatRingWindows(
  windows:readonly RestrictionWindow[],
  secondsOfDay:number,
  approachSeconds=KERAHAT_APPROACH_SECONDS,
):KerahatRingWindow[]{
  if(!Number.isFinite(secondsOfDay)||secondsOfDay<0||secondsOfDay>=86400)
    throw new RangeError('Invalid local time');
  if(!Number.isInteger(approachSeconds)||approachSeconds<0||
    approachSeconds>3600)throw new RangeError('Invalid approach duration');
  return windows.map(window=>{
    const active=secondsOfDay>=window.startSeconds&&secondsOfDay<window.endSeconds;
    const approaching=!active&&secondsOfDay<window.startSeconds&&
      window.startSeconds-secondsOfDay<=approachSeconds;
    return {...window,state:active?'active':approaching?'approaching':'inactive'};
  });
}
