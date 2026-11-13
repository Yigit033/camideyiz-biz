import {timeToMinutes, type PrayerTime} from './prayer.ts';
export type VisualDialSector = PrayerTime & {from:number;to:number};

/**
 * Nonlinear, monotonic presentation scale: 6 readable sectors rather than a
 * huge overnight block. This is NOT a proportional hour clock. The outer
 * progress indicator still uses true elapsed seconds.
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
  const weights=lengths.map(x=>Math.sqrt(x));
  const total=weights.reduce((a,b)=>a+b,0);
  let cursor=0;
  return times.map((time,index)=>{
    const from=cursor;
    cursor+=weights[index]/total*360;
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
