import {normalizeBearing} from './qibla.ts';

/** Qibla tracking is never a sensor-accuracy certification.
 * Pure functions make noisy, jittery, and missing mobile sensor inputs
 * reproducible without collecting or uploading users' coordinates.
 */
export type CompassQuality=0|1|2|3;
export type HeadingFreshness='live'|'recovering'|'stale';
export type HeadingFilter={
  angle:number;rawAngle:number;acceptedAt:number;accuracy:CompassQuality;
  suspectAngle?:number;suspectAt?:number;
};
export type HeadingSample={trueHeading:number;accuracy:number};
export type HeadingResult={filter:HeadingFilter|null;accepted:boolean;updated:boolean};
export const QIBLA_HEADING_LIVE_MS=2600;
export const QIBLA_HEADING_EXPIRED_MS=8000;
export const QIBLA_POSITION_MAX_AGE_MS=4*60*60*1000;
export const QIBLA_POSITION_MAX_ACCURACY_METERS=3000;

export function shortestHeadingDelta(from:number,to:number):number{
  if(!Number.isFinite(from)||!Number.isFinite(to))
    throw new RangeError('Non-finite heading');
  return ((normalizeBearing(to)-normalizeBearing(from)+540)%360)-180;
}

export function headingFreshness(lastAccepted:number|null,now:number):HeadingFreshness{
  if(lastAccepted===null||!Number.isFinite(now)||now<lastAccepted)return 'stale';
  const elapsed=now-lastAccepted;
  return elapsed<=QIBLA_HEADING_LIVE_MS?'live'
    :elapsed<=QIBLA_HEADING_EXPIRED_MS?'recovering':'stale';
}

/** Exponential shortest-arc filter with adaptive lag.
 *  - valid true-north readings only (Expo reports -1 without permission)
 *  - accuracy 0 and non-finite readings are rejected
 *  - a single impossibly fast jump is held until a second corroboration
 *  - genuine quick turns are admitted after confirmation
 *  - wraparound 359° -> 1° never becomes a 358° rotation
 *  - after a long suspension the filter safely restarts from the new pose
 */
export function filterQiblaHeading(
  previous:HeadingFilter|null,sample:HeadingSample,now:number,
):HeadingResult{
  if(!Number.isFinite(now)||now<0)throw new RangeError('Invalid sample timestamp');
  const q=sample.accuracy;
  if(!Number.isInteger(q)||q<1||q>3||
     !Number.isFinite(sample.trueHeading)||sample.trueHeading<0||
     sample.trueHeading>=360)
    return {filter:previous,accepted:false,updated:false};
  const quality=q as CompassQuality;
  const raw=normalizeBearing(sample.trueHeading);
  if(!previous||now<previous.acceptedAt||
    now-previous.acceptedAt>QIBLA_HEADING_EXPIRED_MS)
    return {filter:{angle:raw,rawAngle:raw,accuracy:quality,acceptedAt:now},
      accepted:true,updated:true};
  const elapsed=now-previous.acceptedAt;
  const rawDelta=Math.abs(shortestHeadingDelta(previous.rawAngle,raw));
  const suspicious=(elapsed<130&&rawDelta>65)||
    (elapsed<250&&rawDelta>130);
  if(suspicious){
    const corroborated=previous.suspectAngle!==undefined &&
      previous.suspectAt!==undefined&&now-previous.suspectAt<750&&
      Math.abs(shortestHeadingDelta(previous.suspectAngle,raw))<28;
    if(!corroborated)
      return {filter:{...previous,suspectAngle:raw,suspectAt:now},
        accepted:false,updated:false};
  }
  const diff=shortestHeadingDelta(previous.angle,raw);
  const tau=Math.abs(diff)>25?125:Math.abs(diff)>8?190:310;
  const alpha= Math.max(.12,Math.min(.9,1-Math.exp(-Math.max(8,elapsed)/tau)));
  const maxStep=Math.max(8,Math.min(135,Math.max(16,elapsed)*.85));
  const step=Math.max(-maxStep,Math.min(maxStep,diff*alpha));
  const smoothed=normalizeBearing(previous.angle+step);
  const changed=Math.abs(shortestHeadingDelta(previous.angle,smoothed))>.13;
  return {filter:{
    angle:changed?smoothed:previous.angle,rawAngle:raw,
    acceptedAt:now,accuracy:quality,
  },accepted:true,updated:changed};
}

export type QiblaFix={
  coords:{latitude:number;longitude:number;accuracy:number|null};
  timestamp:number;mocked?:boolean;
};
/** The OS last-known fix is a temporary fallback, never an indefinite cache. */
export function isUsableQiblaFix(
  position:QiblaFix|null|undefined,now:number,
  maxAgeMs=QIBLA_POSITION_MAX_AGE_MS,
  maxAccuracyMeters=QIBLA_POSITION_MAX_ACCURACY_METERS,
):boolean{
  if(!position||position.mocked===true||!Number.isFinite(now)||
    !Number.isFinite(position.timestamp)||position.timestamp>now+5000||
    now-position.timestamp>maxAgeMs)return false;
  const {latitude,longitude,accuracy}=position.coords;
  return Number.isFinite(latitude)&&latitude>=-90&&latitude<=90&&
    Number.isFinite(longitude)&&longitude>=-180&&longitude<=180&&
    accuracy!==null&&Number.isFinite(accuracy)&&accuracy>=0&&
    accuracy<=maxAccuracyMeters;
}
