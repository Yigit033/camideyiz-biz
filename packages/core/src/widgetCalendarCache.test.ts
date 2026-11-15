import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_SCHEDULE} from './prayer.ts';
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
