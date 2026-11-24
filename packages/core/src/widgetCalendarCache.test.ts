import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_SCHEDULE} from './prayer.ts';
import {buildPrayerWidgetSnapshot,buildPrayerWidgetTimeline,prayerInstant} from './prayerCompanion.ts';
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

test('Widget 3.0: a verified ten-day published calendar survives six days offline',()=>{
  const days=Array.from({length:10},(_,offset)=>({
    ...today,dateISO:new Date(Date.UTC(2026,10,10+offset)).toISOString().slice(0,10),
    locationName:'Tuzla',
  }));
  const nowMs=prayerInstant('2026-11-16','08:00');
  const oldSource=prayerInstant('2026-11-10','09:00');
  const original=makeWidgetCalendarCache(9551,'Tuzla',
    'idamedya-diyanet-republished',days,oldSource);
  const restored=parseWidgetCalendarCache(original,nowMs,9551);
  assert.ok(restored,'fetch age alone must not erase published Nov 16/17 times');
  const current=buildPrayerWidgetSnapshot(restored.days,nowMs);
  assert.equal(current.status,'ready');
  assert.equal(current.city,'Tuzla');
  assert.equal(current.dateISO,'2026-11-16');
  assert.equal(current.times.length,6);
  assert.equal(parseWidgetCalendarCache(original,nowMs,9541),null,
    'published timetable may never leak to a different district');
});

test('Widget 3.0: old data must expire even if it carries future-looking dates',()=>{
  const nowMs=prayerInstant('2026-11-16','08:00');
  const tooOld=makeWidgetCalendarCache(9551,'Tuzla','idamedya-diyanet-republished',
    [{...today,locationName:'Tuzla'},{...tomorrow,locationName:'Tuzla'}],
    nowMs-WIDGET_CACHE_MAX_AGE_MS-1000);
  assert.equal(parseWidgetCalendarCache(tooOld,nowMs,9551),null);
});

test('Widget 3.1: 20:44 local after Yatsı still has a real upcoming next-day İmsak',()=>{
  // Fixtures are structurally published-format, not claims about actual
  // Diyanet clock values on this date.
  const days=['2026-11-18','2026-11-19','2026-11-20'].map(dateISO=>({
    ...today,dateISO,locationName:'Tuzla',
    times:today.times.map((p,i)=>({
      ...p,time:['06:11','07:40','12:51','15:27','17:48','19:12'][i],
    })),
  }));
  const now=prayerInstant('2026-11-18','20:44');
  const cache=makeWidgetCalendarCache(9551,'Tuzla',
    'idamedya-diyanet-republished',days,now-30_000);
  const restored=parseWidgetCalendarCache(cache,now,9551);
  assert.ok(restored);
  const initial=buildPrayerWidgetSnapshot(restored.days,now);
  assert.equal(initial.status,'ready');
  assert.equal(initial.nextName,'İmsak');
  assert.equal(initial.nextTime,'06:11');
  assert.equal(initial.dateISO,'2026-11-18');
  const timeline=buildPrayerWidgetTimeline(restored.days,now,100);
  assert.equal(timeline[0].date,now);
  assert.equal(timeline[0].snapshot.status,'ready');
  assert.ok(timeline.length>1);
  for(let i=0;i<timeline.length;i++){
    if(i>0)assert.ok(timeline[i].date>timeline[i-1].date);
    if(timeline[i].snapshot.status==='ready')
      assert.ok(timeline[i].snapshot.nextAt>timeline[i].date,
        'native publish requires next prayer strictly in the future');
  }
  assert.equal(parseWidgetCalendarCache(cache,now,0),null);
  assert.equal(parseWidgetCalendarCache(cache,now,9740),null,
    'Tuzla must never be reused under Karataş or another district');
});

test('published Hijri dates survive the widget cache; anything else is dropped',()=>{
 const withHijri=makeWidgetCalendarCache(9541,today.locationName,'idamedya-diyanet-republished',
   [{...today,hijriDate:'4 Cemaziyelahir 1448'},{...tomorrow,hijriDate:'x'.repeat(121)}],now-30_000);
 const restored=parseWidgetCalendarCache(JSON.parse(JSON.stringify(withHijri)),now,9541);
 assert.equal(restored?.days[0].hijriDate,'4 Cemaziyelahir 1448');
 assert.equal(restored?.days[1].hijriDate,undefined,'oversized text is not a date');
 const forged={...withHijri,days:[{...withHijri.days[0],hijriDate:42},withHijri.days[1]]};
 assert.equal(parseWidgetCalendarCache(forged,now,9541)?.days[0].hijriDate,undefined);
});
