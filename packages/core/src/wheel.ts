/** Pure 360-degree rotating dial math. Independent from React Native. */
export type DialSector = {from: number; to: number};
export function normalizeDegrees(angle: number): number {
  'worklet';
  if (!Number.isFinite(angle)) throw new RangeError('Invalid dial rotation');
  return ((angle % 360) + 360) % 360;
}
export function shortestAngularDelta(start: number, end: number): number {
  'worklet';
  return ((normalizeDegrees(end) - normalizeDegrees(start) + 540) % 360) - 180;
}
/** The sector passing under the fixed 12 o'clock selection needle. */
export function sectorAtNeedle(rotation: number, sectors: readonly DialSector[]): number {
  'worklet';
  const relative = normalizeDegrees(-rotation);
  return sectors.findIndex(x => relative >= x.from && relative < x.to);
}
export function nearestCenterRotation(rotation: number, sector: DialSector): number {
  'worklet';
  const destination = -(sector.from + sector.to) / 2;
  return rotation + shortestAngularDelta(rotation, destination);
}
