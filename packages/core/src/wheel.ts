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
export function angleOfTouch(x: number, y: number, center: number): number {
  'worklet';
  // Clockwise from the 12 o'clock position.
  return Math.atan2(x - center, center - y) * 180 / Math.PI;
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
export function tangentialVelocity(x: number, y: number, vx: number, vy: number): number {
  'worklet';
  const radiusSquared = x * x + y * y;
  if (radiusSquared < 1) return 0;
  const degreesPerSecond = ((x * vy - y * vx) / radiusSquared) * 180 / Math.PI;
  return Math.max(-260, Math.min(260, degreesPerSecond * 0.72));
}
