/** Initial great-circle bearing towards the Kaaba from a WGS84 point. */
const KAABA = { latitude: 21.4225, longitude: 39.8262 } as const;
const radians = (degrees: number) => degrees * Math.PI / 180;
const degrees = (radiansValue: number) => radiansValue * 180 / Math.PI;
export function normalizeBearing(value: number): number { return ((value % 360) + 360) % 360; }
export function qiblaBearing(latitude: number, longitude: number): number {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new RangeError('Invalid latitude');
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new RangeError('Invalid longitude');
  const phi1 = radians(latitude), phi2 = radians(KAABA.latitude);
  const deltaLambda = radians(KAABA.longitude - longitude);
  const y = Math.sin(deltaLambda);
  const x = Math.cos(phi1) * Math.tan(phi2) - Math.sin(phi1) * Math.cos(deltaLambda);
  if (Math.abs(x) < 1e-12 && Math.abs(y) < 1e-12) throw new RangeError('Bearing undefined near Kaaba');
  return normalizeBearing(degrees(Math.atan2(y, x)));
}
/** Clockwise degrees from device TRUE north heading to the qibla. */
export function relativeQiblaAngle(bearing: number, trueHeading: number): number {
  return normalizeBearing(bearing - trueHeading);
}
