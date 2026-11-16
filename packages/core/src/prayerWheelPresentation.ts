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

/** Compact clock+name capsule on the separator; icon sits in a distinct
 * inner radial lane so even adjacent 20-degree wedges remain legible.
 * Separators and icons travel with the ring, their text counter-rotates.
 */
export function prayerSectorVisualLayout(from:number,to:number){
  const middle=prayerSectorLabelAngle(from,to);
  const narrow=to-from<30;
  return {
    labelAngle:middle,
    labelRadius:117,
    labelWidth:19,
    labelHeight:19,
    iconSize:narrow?15:17,
    fontSize:10,
    clockAngle:from,
    clockRadius:151,
    clockWidth:52,
    clockHeight:31,
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
