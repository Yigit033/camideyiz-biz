import {
  type PrayerKey, type PrayerSchedule, type PrayerTime, PRAYER_KEYS,
  timeToMinutes,
} from './prayer.ts';

/** All times and dates are local to PrayerSchedule.timezone. */
export type WarningKind = 'sunrise' | 'zenith' | 'sunset';
export type RestrictionWindow = {
  kind: WarningKind;
  startSeconds: number;
  endSeconds: number;
  title: string;
  description: string;
  approximate: true;
};
export type Urgency = 'normal' | 'approaching' | 'imminent';
export type PrayerPhase = {
  next: PrayerTime;
  current: PrayerTime;
  previousBoundary: number;
  nextBoundary: number;
  progress: number;
  secondsRemaining: number;
  urgency: Urgency;
};
export type TimeAwareness = {
  phase: PrayerPhase;
  restriction: RestrictionWindow | null;
  /** Every kerahat window produced by the prototype is indicative, NEVER an official ruling. */
  indicativeWindows: readonly RestrictionWindow[];
  /** A live feed must supply the matching local date; stale data never produces live guidance. */
  usableForGuidance: boolean;
};

function validateSchedule(schedule: PrayerSchedule): readonly PrayerTime[] {
  if (schedule.times.length !== PRAYER_KEYS.length) {
    throw new RangeError('Six daily time boundaries required');
  }
  for (let i = 0; i < PRAYER_KEYS.length; i++) {
    if (schedule.times[i].key !== PRAYER_KEYS[i]) {
      throw new RangeError('Prayer keys out of order');
    }
    if (i && timeToMinutes(schedule.times[i].time) <= timeToMinutes(schedule.times[i - 1].time)) {
      throw new RangeError('Prayer times must increase during the local day');
    }
  }
  return schedule.times;
}

function percent(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Calculate smooth progress between actual prayer boundaries; supports midnight rollover.
 * The caller is responsible for fetching the following day's times for production use.
 */
export function calculatePrayerPhase(schedule: PrayerSchedule, secondsOfDay: number): PrayerPhase {
  if (!Number.isFinite(secondsOfDay) || secondsOfDay < 0 || secondsOfDay >= 86400) {
    throw new RangeError('Invalid local seconds of day');
  }
  const times = validateSchedule(schedule);
  const markers = times.map(item => timeToMinutes(item.time) * 60);
  let nextIndex = markers.findIndex(second => second > secondsOfDay);
  if (nextIndex === -1) nextIndex = 0;
  const currentIndex = (nextIndex + times.length - 1) % times.length;
  const previousBoundary = secondsOfDay < markers[0]
    ? markers[times.length - 1] - 86400
    : markers[currentIndex];
  const nextBoundary = nextIndex === 0 && secondsOfDay >= markers[times.length - 1]
    ? markers[0] + 86400
    : markers[nextIndex];
  const secondsRemaining = nextBoundary - secondsOfDay;
  const progress = percent((secondsOfDay - previousBoundary) / (nextBoundary - previousBoundary));
  const urgency: Urgency = secondsRemaining <= 15*60 ? 'imminent'
    : secondsRemaining <= 45*60 ? 'approaching'
    : 'normal';
  return {
    next: times[nextIndex], current: times[currentIndex],
    previousBoundary, nextBoundary, progress, secondsRemaining, urgency,
  };
}

/** 
 * Diyanet Din İşleri Yüksek Kurulu: common *approximate* windows in temperate areas.
 * Do not infer official minute-accurate intervals from these values; actual solar altitude,
 * juristic interpretation and high latitudes may change applicability.
 */
export function indicativeKerahatWindows(
  schedule: PrayerSchedule,
  options: {sunriseMinutes?:number;preNoonMinutes?:number;preSunsetMinutes?:number} = {},
): RestrictionWindow[] {
  validateSchedule(schedule);
  const sunriseMinutes=options.sunriseMinutes ?? 45;
  const preNoonMinutes=options.preNoonMinutes ?? 10;
  const preSunsetMinutes=options.preSunsetMinutes ?? 45;
  for (const offset of [sunriseMinutes,preNoonMinutes,preSunsetMinutes]) {
    if (!Number.isFinite(offset) || offset < 0 || offset > 120) {
      throw new RangeError('Invalid illustrative window offset');
    }
  }
  const m:Record<PrayerKey,number> = Object.fromEntries(
    schedule.times.map(item=>[item.key,timeToMinutes(item.time)])
  ) as Record<PrayerKey,number>;
  const candidates: RestrictionWindow[] = [
    {
      kind:'sunrise', startSeconds:m.gunes*60,
      endSeconds:(m.gunes+sunriseMinutes)*60,
      title:'Güneş doğuşu · kerahet',
      description:'Güneş doğuşundan sonraki yaklaşık 40–50 dakika. Namaz türüne göre hükümler farklıdır.',
      approximate:true,
    },
    {
      kind:'zenith', startSeconds:(m.ogle-preNoonMinutes)*60,
      endSeconds:m.ogle*60,
      title:'Zeval · kerahet',
      description:'Öğle vaktinden yaklaşık 10 dakika önceki kısıtlı zaman aralığı.',
      approximate:true,
    },
    {
      kind:'sunset', startSeconds:(m.aksam-preSunsetMinutes)*60,
      endSeconds:m.aksam*60,
      title:'Gün batımı · kerahet',
      description:'Akşama yaklaşık 40–50 dakika kala. O günün ikindi farzına ilişkin istisna vardır.',
      approximate:true,
    },
  ];
  // Reject overlapping or physically invalid windows instead of painting false warnings.
  const windows=candidates.sort((a,b)=>a.startSeconds-b.startSeconds);
  if(windows.some((w,i)=>w.startSeconds<0||w.endSeconds>86400||
     w.startSeconds>=w.endSeconds||(i>0&&w.startSeconds<windows[i-1].endSeconds))) {
    return [];
  }
  return windows;
}

/** Feature flag makes use of approximate religious windows an explicit prototype decision. */
export function calculateTimeAwareness(
  schedule:PrayerSchedule,secondsOfDay:number,
  localDateISO:string,
  indicativeMode:boolean=false,
):TimeAwareness {
  const phase=calculatePrayerPhase(schedule,secondsOfDay);
  const usableForGuidance=!schedule.isDemo && schedule.dateISO===localDateISO;
  const indicativeWindows=indicativeMode && schedule.isDemo
    ? indicativeKerahatWindows(schedule)
    : [];
  const restriction=indicativeWindows.find(w=>secondsOfDay>=w.startSeconds && secondsOfDay<w.endSeconds)??null;
  return {phase,restriction,indicativeWindows,usableForGuidance};
}

export function minutesToNextEvent(seconds:number):string {
  if(seconds<0||!Number.isFinite(seconds))throw new RangeError('Invalid remaining seconds');
  const minutes=Math.ceil(seconds/60);
  return minutes>=60 ? Math.floor(minutes/60)+' sa '+(minutes%60)+' dk' : minutes+' dk';
}
