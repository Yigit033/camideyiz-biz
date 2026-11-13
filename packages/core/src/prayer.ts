/** Pure prayer schedule helpers. Times are local to the named IANA timezone. */
export const PRAYER_KEYS = ['imsak', 'gunes', 'ogle', 'ikindi', 'aksam', 'yatsi'] as const;
export type PrayerKey = (typeof PRAYER_KEYS)[number];
export type PrayerTime = { key: PrayerKey; label: string; time: string };
export type PrayerSchedule = {
  locationName: string;
  timezone: string;
  dateISO: string;
  isDemo: boolean;
  times: readonly PrayerTime[];
};
/** DEMO ONLY: NOT VALID RELIGIOUS PRAYER TIMES. */
export const DEMO_SCHEDULE: PrayerSchedule = {
  locationName: 'İstanbul', timezone: 'Europe/Istanbul', dateISO: '2026-11-13', isDemo: true,
  times: [
    {key: 'imsak', label: 'İmsak', time: '05:31'},
    {key: 'gunes', label: 'Güneş', time: '07:02'},
    {key: 'ogle', label: 'Öğle', time: '12:48'},
    {key: 'ikindi', label: 'İkindi', time: '16:09'},
    {key: 'aksam', label: 'Akşam', time: '19:21'},
    {key: 'yatsi', label: 'Yatsı', time: '20:46'},
  ],
};
export function timeToMinutes(clock: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(clock)) throw new RangeError('Invalid HH:MM');
  const [h, m] = clock.split(':').map(Number);
  return h * 60 + m;
}
export function zonedClock(date: Date, timezone: string): {dateISO: string; secondsOfDay: number} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  const value = (part: string) => Number(parts.find(p => p.type === part)?.value ?? 0);
  const dateISO = [value('year'), String(value('month')).padStart(2,'0'), String(value('day')).padStart(2,'0')].join('-');
  return {dateISO,secondsOfDay: value('hour')*3600 + value('minute')*60 + value('second')};
}
export function nextPrayerAtSeconds(schedule: PrayerSchedule, secondsOfDay: number) {
  if (!Number.isFinite(secondsOfDay) || secondsOfDay < 0 || secondsOfDay >= 86400) throw new RangeError('Invalid secondsOfDay');
  const sorted = [...schedule.times].sort((a,b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  if (!sorted.length) throw new Error('Empty prayer schedule');
  const next = sorted.find(x => timeToMinutes(x.time)*60 > secondsOfDay);
  if (next) return {prayer:next, secondsRemaining:timeToMinutes(next.time)*60 - secondsOfDay};
  return {prayer:sorted[0],secondsRemaining:86400 + timeToMinutes(sorted[0].time)*60 - secondsOfDay};
}
export function formatCountdown(seconds: number): string {
  const safe = Math.max(0,Math.floor(seconds));
  const h = Math.floor(safe/3600), m=Math.floor((safe%3600)/60), s=safe%60;
  return [h,m,s].map(x=>String(x).padStart(2,'0')).join(':');
}
