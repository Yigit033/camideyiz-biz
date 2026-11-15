import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_SCHEDULE} from './prayer.ts';
import {buildPrayerWidgetSnapshot,prayerInstant} from './prayerCompanion.ts';
import {makeWidgetCalendarCache,parseWidgetCalendarCache,
  WIDGET_CACHE_MAX_AGE_MS} from './widgetCalendarCache.ts';

const now=Date.parse('2026-11-15T09:00:00Z');
const today={...DEMO_SCHEDULE,dateISO:'2026-11-15',
  isDemo:false,locationName:'İstanbul'};
const tomorrow={...today,dateISO:'2026-11-16'};
const published=makeWidgetCalendarCache(9541,'İstanbul',
  'idamedya-diyanet-republished',[today,tomorrow],now-30_000);
test('validated published widget calendar survives an app restart',()=>{
 const stored=JSON.parse(JSON.stringify(published));
 assert.equal(parseWidgetCalendarCache(stored,now,9541)?.days.length,2);
 assert.equal(parseWidgetCalendarCache(stored,now,9541)?.days[0].dateISO,'2026-11-15');
});
test('wrong district, stale date, forged or non-ordered clock fail closed',()=>{
 assert.equal(parseWidgetCalendarCache(published,now,1111),null);
 assert.equal(parseWidgetCalendarCache(published,now+WIDGET_CACHE_MAX_AGE_MS+100_000,9541),null);
 assert.equal(parseWidgetCalendarCache({...published,days:[{...today,isDemo:true},tomorrow]},now,9541),null);
 assert.equal(parseWidgetCalendarCache({...published,days:[today,{...tomorrow,dateISO:'2026-11-18'}]},now,9541),null);
 const times=[...tomorrow.times].map(t=>({...t}));
 times[3].time='00:01';
 assert.equal(parseWidgetCalendarCache({...published,days:[today,{...tomorrow,times}]},now,9541),null);
});

test('REGRESSION: published Tuzla 6-prayer calendar survives transient loading and midnight',()=>{
  // Published-format times are fixed test fixtures, NOT current upstream claims.
  const makeDay=(dateISO:string,imsak:string)=>({
    ...today,dateISO,isDemo:false,locationName:'Tuzla',
    times:today.times.map((v,i)=>({
      ...v,time:[imsak,'07:45','12:54','15:29','17:53','19:16'][i],
    })),
  });
  const days=[
    makeDay('2026-11-14','06:14'),
    makeDay('2026-11-15','06:15'),
    makeDay('2026-11-16','06:16'),
  ];
  const time=prayerInstant('2026-11-15','16:00');
  const cache=makeWidgetCalendarCache(9551,'Tuzla',
    'idamedya-diyanet-republished',days,time-8*60_000);
  const usable=parseWidgetCalendarCache(cache,time,9551);
  assert.ok(usable);
  const widget=buildPrayerWidgetSnapshot(usable.days,time);
  assert.equal(widget.status,'ready');
  assert.equal(widget.city,'Tuzla');
  assert.equal(widget.dateISO,'2026-11-15');
  assert.equal(widget.times.length,6);
  assert.equal(widget.times[0].time,'06:15');
  assert.equal(widget.nextName,'Akşam');
  assert.equal(widget.nextTime,'17:53');
  assert.equal(parseWidgetCalendarCache(cache,time,9545),null,
    'an unrelated Pendik selection must NEVER reuse Tuzla times');
  assert.equal(parseWidgetCalendarCache(cache,time,9740),null,
    'a Tarsus selection must NEVER reuse Tuzla times');
  const midnight=prayerInstant('2026-11-16','00:00')+1000;
  const tomorrowCache=parseWidgetCalendarCache(cache,midnight,9551);
  assert.ok(tomorrowCache);
  const tomorrowWidget=buildPrayerWidgetSnapshot(tomorrowCache.days,midnight);
  assert.equal(tomorrowWidget.dateISO,'2026-11-16');
  assert.equal(tomorrowWidget.times[0].time,'06:16');
  assert.equal(tomorrowWidget.nextName,'İmsak');
  assert.equal(tomorrowWidget.nextTime,'06:16');
});
test('REGRESSION: only one published day or stale data never becomes a native widget clock',()=>{
  const missing=makeWidgetCalendarCache(9551,'Tuzla',
    'idamedya-diyanet-republished',[today],now);
  assert.equal(parseWidgetCalendarCache(missing,now,9551),null);
  const stale=makeWidgetCalendarCache(9551,'Tuzla',
    'idamedya-diyanet-republished',[today,tomorrow],
    now-WIDGET_CACHE_MAX_AGE_MS-1000);
  assert.equal(parseWidgetCalendarCache(stale,now,9551),null);
});
