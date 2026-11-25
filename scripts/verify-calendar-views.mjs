import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const r=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const home=r('apps/mobile/src/app/(tabs)/index.tsx');
const cards=r('apps/mobile/src/features/calendar/HomeCalendarSection.tsx');
const screen=r('apps/mobile/src/app/calendar30.tsx');
const days=r('apps/mobile/src/app/religious-days.tsx');
const route=r('apps/mobile/src/app/_layout.tsx');
const provider=r('apps/mobile/src/features/calendar/calendar30Api.ts');
const api=r('apps/api/src/app/api/v1/calendar30/route.ts');
assert.match(home,/HomeCalendarSection dateISO=\{zoned\.dateISO\}/);
assert.match(home,/HomeCalendarSection dateISO=\{zonedClock\(now,'Europe\/Istanbul'\)\.dateISO\}/);
assert.match(cards,/router\.push\('\/calendar30'\)/);
assert.match(cards,/router\.push\('\/religious-days'\)/);
assert.match(cards,/upcomingReligiousDay\(dateISO\)/);
assert.doesNotMatch(home,/fetchCalendar30/,'home must not start 30-day network calls');
assert.match(screen,/useCalendar30\(dateISO\)/);
assert.match(screen,/Yayımlanmış veri bekleniyor/);
// Calendar 2.0 (25.11.2026): the 30 days are ONE compact table that fills
// the page. No expanding/collapsing day cards, no virtualised card list.
assert.doesNotMatch(screen,/FlatList|setExpanded|expanded:|chevron-(up|down)/,
  'the 30-day calendar must not collapse or expand');
assert.match(screen,/const DAYS=30;/);
assert.match(screen,/data\.map\(\(item,index\)=><DayRow /,'all 30 rows render at once');
assert.match(screen,/day\.times\.map\(t=>/,'every row shows the six published clocks');
assert.match(screen,/const COLUMNS=\['İmsak','Güneş','Öğle','İkindi','Akşam','Yatsı'\] as const;/);
assert.match(screen,/onLayout=\{e=>setRoom\(e\.nativeEvent\.layout\.height\)\}/,
  'rows are sized from the measured page height');
assert.match(screen,/rowHeight=body>0\?Math\.max\(minRow,Math\.min\(stacked\?54:MAX_ROW,body\/DAYS\)\)/);
assert.match(screen,/scrollEnabled=\{!fits\}/,'the table scrolls only when it cannot fit');
// Today is highlighted; the selected day's long date and Hijri date stay visible.
assert.match(screen,/today=\{item\.iso===dateISO\}/);
assert.match(screen,/borderLeftWidth:today\?3:0,borderLeftColor:colors\.gold/);
assert.match(screen,/chosen\.day\.hijriDate/);
for(const copy of ['BUGÜN','Bu günün vakitleri henüz yayımlanmadı.','30 günlük takvim hazır',
  'Önce ana sayfadan il veya ilçe seç','Takvim yükleniyor…','Namaz takvimi alınamadı',
  'Yeniden dene','İnternet bağlantını kontrol edip yeniden dene.','place.stateName',
  'günün vakitleri hazır'])
  assert.ok(screen.includes(copy),'calendar lost information: '+copy);
// Safe areas and large system fonts: numbers scale to 130% then shrink to
// fit; if the clocks no longer fit beside the date, the date moves above.
assert.match(screen,/<SafeAreaView edges=\{\['top','bottom'\]\}/);
assert.match(screen,/const TABLE_MAX_SCALE=1\.3;/);
assert.match(screen,/maxFontSizeMultiplier=\{TABLE_MAX_SCALE\}/);
assert.ok((screen.match(/adjustsFontSizeToFit/g)??[]).length>=4,'table cells shrink instead of clipping');
assert.match(screen,/const stacked=clocksRoom-dateWidth<6\*\(TIME_SIZE\*textScale\*2\.55\+6\);/);
// A 360×800 dp phone (3-button navigation, ~614 dp below header and day
// strip) shows all 30 rows without scrolling at the default font size.
{
  const num=name=>Number(screen.match(new RegExp('const '+name+'=([0-9.]+);'))?.[1]);
  const [size,header]=[num('TIME_SIZE'),num('HEADER_ROW')];
  assert.ok(size>=12&&header>0,'table constants missing');
  assert.ok(screen.includes('const minRow=Math.ceil(TIME_SIZE*textScale*(stacked?2.3:1.2)+(stacked?8:2));'),
    'row height formula changed: re-check the 360×800 fit below');
  const minRow=Math.ceil(size*1.2+2);
  assert.ok((614-header-2)/30>=minRow,'30 rows no longer fit one 360×800 screen');
  const dateWidth=Math.round(Math.min(96,Math.max(70,(360-28)*.22)));
  assert.ok(360-16-2-12-dateWidth>=6*(size*2.55+6),'clocks no longer fit beside the date on 360 dp');
}
assert.match(days,/religiousDaysFrom\(current\)/);
// Copy policy (22.11.2026): no source/disclaimer links in the UI; the
// Diyanet source URL stays in core data for audits only.
assert.doesNotMatch(days,/Diyanet kaynağını aç|Kaynak: T\.C\./);
assert.match(route,/<Stack\.Screen name="calendar30"/);
assert.match(route,/<Stack\.Screen name="religious-days"/);
assert.match(provider,/mergeCalendar30\(snapshots\)/);
const hook=r('apps/mobile/src/features/calendar/useCalendar30.ts');
assert.match(hook,/if\(revision===0\)try/,
  'manual refresh must bypass cached published days');
assert.match(hook,/controller\.abort\(\)/,
  'unmount or district switch must cancel pending requests');
assert.match(api,/officialCalendar30\(cityId,date\)/);
console.log('Calendar 2.0: one-page 30-day table (today highlighted, six clocks, no collapsing), lazy verified days, home cards, routed screens and Diyanet annual events OK');
