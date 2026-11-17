import {timeToMinutes, type PrayerTime} from './prayer.ts';
export type VisualDialSector = PrayerTime & {from:number;to:number};

/**
 * An honest 24-hour timeline: a wedge spans exactly its daily clock duration
 * / 1440 minutes * 360°. The six published starts are ascending on the named
 * local day. The last wedge crosses midnight and ends at the same clock-time
 * imsak on the next 24-hour rotation; no decorative sqrt/time distortion.
 *
 * NOTE: day-to-day actual imsak can shift a minute. A 24h civil clock and
 * six published starts on the displayed date cannot also show tomorrow's
 * different imsak without breaking the exact 360°/24h contract. The next
 * day's actual time comes from tomorrow's independent schedule.
 */
export function makeVisualDialSectors(times:readonly PrayerTime[]):VisualDialSector[]{
  if(times.length===0)return [];
  const minutes=times.map(item=>timeToMinutes(item.time));
  for(let i=1;i<minutes.length;i++){
    if(minutes[i]<=minutes[i-1])throw new RangeError('Prayer boundaries must be ascending');
  }
  const lengths=minutes.map((start,i)=>i===minutes.length-1
    ? 1440-start+minutes[0]
    : minutes[i+1]-start);
  if(lengths.some(x=>x<=0))throw new RangeError('Invalid duration');
  if(lengths.reduce((sum,length)=>sum+length,0)!==1440)
    throw new RangeError('Prayer sectors must span exactly 24 hours');
  let cursor=0;
  return times.map((time,index)=>{
    const from=cursor;
    cursor+=lengths[index]/1440*360;
    return {...time,from,to:index===times.length-1?360:cursor};
  });
}

export function clockSecondsToVisualAngle(
  secondsOfDay:number,times:readonly PrayerTime[],
  sectors:readonly {from:number;to:number}[],
):number{
  if(!Number.isFinite(secondsOfDay)||secondsOfDay<0||secondsOfDay>=86400){
    throw new RangeError('Expected local seconds 0..86399');
  }
  if(times.length===0)return 0;
  if(sectors.length!==times.length)throw new RangeError('Sector mismatch');
  const starts=times.map(item=>timeToMinutes(item.time)*60);
  const shifted=secondsOfDay<starts[0]?secondsOfDay+86400:secondsOfDay;
  const index=starts.findIndex((start,i)=>{
    const end=i===starts.length-1?starts[0]+86400:starts[i+1];
    return shifted>=start&&shifted<end;
  });
  if(index<0)throw new RangeError('Invalid boundary coverage');
  const start=starts[index],end=index===starts.length-1?starts[0]+86400:starts[index+1];
  const ratio=Math.max(0,Math.min(1,(shifted-start)/(end-start)));
  return sectors[index].from+(sectors[index].to-sectors[index].from)*ratio;
}

/** Live 12-o'clock dial alignment. Keep angle unwrapped so the prayer wedge
 * crossing 360° (next İmsak) never causes an entire reverse revolution.
 * A complete dial revolution corresponds to 24h of actual published time.
 */
export function nearestLiveDialRotation(currentRotation:number,clockAngle:number):number{
  if(!Number.isFinite(currentRotation)||!Number.isFinite(clockAngle)||
     clockAngle<0||clockAngle>360)
    throw new RangeError('Invalid live dial angle');
  const target=-clockAngle;
  return target+360*Math.round((currentRotation-target)/360);
}
