import {type PrayerSchedule} from './prayer.ts';
import {indicativeKerahatWindows,type RestrictionWindow} from './timeline.ts';

export const KERAHAT_SOURCE_URL =
  'https://kurul.diyanet.gov.tr/tr/fetva/mekruh-vakitler-hangileridir-hangi-vakitlerde-kaza-ve-hangi-vakitlerde-nafile-namaz-kilinmaz/0193c42d-52b7-7186-d5b4-f1d3c950ad73';

/** 'standard' is accepted for persisted legacy preferences only. */
export type KerahatMode = 'standard' | 'custom' | 'hidden';
export type KerahatSettings = {
  mode:KerahatMode;
  sunriseMinutes:number;
  preNoonMinutes:number;
  preSunsetMinutes:number;
};
export const DEFAULT_KERAHAT_SETTINGS:Readonly<KerahatSettings> = {
  // Turkey-oriented PRODUCT defaults for the adjustable warning overlay.
  // Diyanet's published approximate noon guidance is ~10 min, NOT 30 min.
  // This configurable 30-minute precaution is not an official religious ruling.
  mode:'custom',sunriseMinutes:45,preNoonMinutes:30,preSunsetMinutes:45,
};
export const KERAHAT_RANGES = {
  sunriseMinutes:{min:40,max:50},
  preNoonMinutes:{min:5,max:45},
  preSunsetMinutes:{min:40,max:50},
} as const;
/** Upgrade a v2 on-device preference without overwriting real custom offsets.
 * The old app saved 45/10/45 even when no control was adjusted. For exactly
 * that legacy factory profile, adopt the owner's new 45/30/45 defaults.
 * A legacy profile with different numbers is intentionally left untouched.
 * Old storage cannot distinguish a manually selected 45/10/45 from factory
 * values; that one identical combination necessarily follows the new default.
 */
export function migrateLegacyKerahatSettings(value:unknown):KerahatSettings{
  const legacy=validateKerahatSettings(value);
  if(legacy.sunriseMinutes===45 && legacy.preNoonMinutes===10 &&
     legacy.preSunsetMinutes===45){
    return {...legacy,preNoonMinutes:DEFAULT_KERAHAT_SETTINGS.preNoonMinutes};
  }
  return legacy;
}

export type KerahatKind=RestrictionWindow['kind'];
export type KerahatView={
  windows:readonly RestrictionWindow[];
  active:RestrictionWindow|null;
  next:RestrictionWindow|null;
  /** This is a locally adjustable visual estimate, never a religious ruling. */
  method:'configurable-approximate';
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
    windows:[],active:null,next:null,method:'configurable-approximate',
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
    method:'configurable-approximate',
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
