import {type PrayerSchedule} from './prayer.ts';
import {indicativeKerahatWindows,type RestrictionWindow} from './timeline.ts';

export const KERAHAT_SOURCE_URL =
  'https://kurul.diyanet.gov.tr/tr/fetva/mekruh-vakitler-hangileridir-hangi-vakitlerde-kaza-ve-hangi-vakitlerde-nafile-namaz-kilinmaz/0193c42d-52b7-7186-d5b4-f1d3c950ad73';

export type KerahatMode = 'standard' | 'custom' | 'hidden';
export type KerahatSettings = {
  mode:KerahatMode;
  sunriseMinutes:number;
  preNoonMinutes:number;
  preSunsetMinutes:number;
};
export const DEFAULT_KERAHAT_SETTINGS:Readonly<KerahatSettings> = {
  mode:'standard',sunriseMinutes:45,preNoonMinutes:10,preSunsetMinutes:45,
};
export const KERAHAT_RANGES = {
  sunriseMinutes:{min:40,max:50},
  preNoonMinutes:{min:5,max:15},
  preSunsetMinutes:{min:40,max:50},
} as const;
export type KerahatKind=RestrictionWindow['kind'];
export type KerahatView={
  windows:readonly RestrictionWindow[];
  active:RestrictionWindow|null;
  next:RestrictionWindow|null;
  /** This is a locally adjustable visual estimate, never a religious ruling. */
  method:'diyanet-inspired-approximate';
  isCustom:boolean;
};

export function validateKerahatSettings(value:unknown):KerahatSettings {
  if(!value||typeof value!=='object'||Array.isArray(value))
    throw new RangeError('Invalid kerahat settings object');
  const o=value as Record<string,unknown>;
  if(o.mode!=='standard'&&o.mode!=='custom'&&o.mode!=='hidden')
    throw new RangeError('Invalid kerahat mode');
  for(const key of ['sunriseMinutes','preNoonMinutes','preSunsetMinutes'] as const){
    const amount=o[key],range=KERAHAT_RANGES[key];
    if(typeof amount!=='number'||!Number.isInteger(amount)||
      amount<range.min||amount>range.max)
      throw new RangeError('Invalid visual kerahat offset: '+key);
  }
  return {
    mode:o.mode,
    sunriseMinutes:o.sunriseMinutes as number,
    preNoonMinutes:o.preNoonMinutes as number,
    preSunsetMinutes:o.preSunsetMinutes as number,
  };
}
export function getKerahatView(
  schedule:PrayerSchedule,
  localDateISO:string,
  secondsOfDay:number,
  prefs:KerahatSettings=DEFAULT_KERAHAT_SETTINGS,
):KerahatView{
  const settings=validateKerahatSettings(prefs);
  if(!Number.isFinite(secondsOfDay)||secondsOfDay<0||secondsOfDay>=86400)
    throw new RangeError('Invalid seconds of day');
  const empty:KerahatView={
    windows:[],active:null,next:null,method:'diyanet-inspired-approximate',
    isCustom:settings.mode==='custom',
  };
  // Never paint religious guidance on demo, stale or wrong-date schedules.
  if(settings.mode==='hidden'||schedule.isDemo||schedule.dateISO!==localDateISO)return empty;
  const offsets=settings.mode==='standard'
    ?DEFAULT_KERAHAT_SETTINGS:settings;
  const windows=indicativeKerahatWindows(schedule,{
    sunriseMinutes:offsets.sunriseMinutes,
    preNoonMinutes:offsets.preNoonMinutes,
    preSunsetMinutes:offsets.preSunsetMinutes,
  });
  return {
    windows,
    active:windows.find(w=>secondsOfDay>=w.startSeconds&&secondsOfDay<w.endSeconds)??null,
    next:windows.find(w=>w.startSeconds>secondsOfDay)??null,
    method:'diyanet-inspired-approximate',
    isCustom:settings.mode==='custom',
  };
}
export function formatWindowClock(seconds:number):string {
  if(!Number.isInteger(seconds)||seconds<0||seconds>=86400)
    throw new RangeError('Invalid window time');
  const h=Math.floor(seconds/3600),m=Math.floor((seconds%3600)/60);
  return [h,m].map(v=>String(v).padStart(2,'0')).join(':');
}
export function kerahatWindowLabel(kind:KerahatKind):string{
  switch(kind){
    case 'sunrise':return 'Güneş doğuşu';
    case 'zenith':return 'Zeval (öğle öncesi)';
    case 'sunset':return 'Gün batımı';
  }
}
