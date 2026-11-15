import type {RestrictionWindow} from './timeline.ts';

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
  const inset=Math.max(14,Math.min(31,span*.43));
  return Math.min(to-8,from+inset);
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
