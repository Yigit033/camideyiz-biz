import type {RestrictionWindow} from './timeline.ts';
import {timeToMinutes,type PrayerTime} from './prayer.ts';
import {clockSecondsToVisualAngle} from './visualDial.ts';

/** Positions for the *visual* prayer wheel. Clock pills stay anchored close
 * to the opening boundary, while icons/names sit adjacent inside the sector.
 * This is a non-linear visual dial, NOT a proportional civil-time clock.
 */
export function prayerSectorLabelAngle(from:number,to:number):number{
  if(!Number.isFinite(from)||!Number.isFinite(to)||
    from<0||to>360||to<=from)throw new RangeError('Invalid dial sector');
  const span=to-from;
  // Move from the sector midpoint toward its starting clock without
  // compressing labels into the previous boundary on narrow sectors.
  // Actual 24-hour sectors can span 20° (Akşam) or over 160° (Yatsı).
  // Cap the name's offset on LONG sectors too, so the word stays alongside
  // its start-time badge instead of drifting into the enormous night wedge.
  const inset=span<30?span*.43:span<=55?span/2:Math.max(13,Math.min(20,span*.33));
  return from+Math.min(span*.49,inset);
}


/** Presentation measurements in the same 360-unit dial coordinate system.
 * Boundary clocks are centered EXACTLY on the dark separator, inside the rim.
 * Short wedges place their compact icon/title closer to the inner circular
 * band, not under the start-time badge. The artwork/sector angles never move.
 */
export function prayerSectorVisualLayout(from:number,to:number){
  const angle=prayerSectorLabelAngle(from,to);
  const span=to-from;
  const narrow=span<30;
  const middle=span<56;
  return {
    labelAngle:angle,
    labelRadius:narrow?122:middle?127:130,
    labelWidth:narrow?54:middle?59:68,
    labelHeight:narrow?33:middle?36:39,
    iconSize:narrow?13.5:middle?14.5:15.5,
    fontSize:narrow?10.4:middle?11.6:12.5,
    clockAngle:from,
    clockRadius:152,
    clockWidth:45,
    clockHeight:18.5,
  };
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
