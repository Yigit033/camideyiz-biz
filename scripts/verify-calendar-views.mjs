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
// Calendar 3.0 (owner, 26.11.2026, after his sketch): the thirty dates stay
// on one page as a three-column grid (Hijri day and month, Gregorian date,
// weekday); a tapped date opens its six clocks right under its row, joined
// to the date by a tab. One open day at a time; a second tap closes it.
assert.match(screen,/const DAYS=30;/);
assert.match(screen,/const PER_ROW=3;/);
assert.match(screen,/rows\.map\(\(row,r\)=>/,'all ten rows render at once');
assert.match(screen,/row\.map\(item=><DateCell /,'every row shows its three dates');
assert.doesNotMatch(screen,/FlatList|SectionList/,'no virtualised list: the month is one page');
assert.match(screen,/setOpen\(current=>\{[\s\S]{0,120}current===iso\?null:iso/,
  'a tap opens a date, a second tap closes it');
assert.match(screen,/openItem\?<DayPanel /,'the panel opens under the tapped date\'s row');
assert.match(screen,/day\.times\.map\(\(t,i\)=>/,'the panel shows the six published clocks');
assert.match(screen,/position:'absolute',top:-\(GAP\+EDGE\)-1,\s*left:column\*\(cellWidth\+GAP\)-EDGE,width:cellWidth,/,
  'the tab joins the date to its panel');
assert.match(screen,/borderBottomColor:'transparent',\s*borderBottomLeftRadius:0,borderBottomRightRadius:0/,
  'an open date has no foot: it runs into its panel');
assert.match(screen,/borderTopLeftRadius:column===0\?0:16,borderTopRightRadius:column===PER_ROW-1\?0:16/);
assert.match(screen,/entering=\{FadeIn\.duration\(190\)\} exiting=\{FadeOut\.duration\(110\)\}/);
assert.match(screen,/layout=\{LinearTransition\.duration\(220\)\}/,'rows below glide instead of jumping');
assert.match(screen,/useEffect\(\(\)=>setOpen\(null\),\[dateISO,place\?\.id\]\)/,
  'a new day or district starts closed');
// Owner: "all fonts the same size". One size per text role for all thirty
// cells, from the cell width and the system font, never cell by cell.
assert.doesNotMatch(screen,/adjustsFontSizeToFit/,'no cell shrinks its own text');
assert.ok((screen.match(/allowFontScaling=\{false\}/g)??[]).length>=8,'the system font is applied once, centrally');
assert.match(screen,/const TEXT_MAX_SCALE=1\.3;/);
assert.match(screen,/onLayout=\{e=>setRoom\(e\.nativeEvent\.layout\.height\)\}/,
  'cells are sized from the measured page height');
// Today and Friday stand out; the open day shows its long Gregorian and Hijri dates.
assert.match(screen,/today=\{item\.iso===dateISO\}/);
assert.match(screen,/borderColor:open\?look\.openEdge:today\?colors\.gold:colors\.border/);
assert.match(screen,/color:friday\?colors\.gold:colors\.muted/);
assert.match(screen,/\{day\?\.hijriDate\?\?''\}/);
for(const copy of ['BUGÜN','Bu günün vakitleri henüz yayımlanmadı.','30 günlük takvim hazır',
  'Önce ana sayfadan il veya ilçe seç','Takvim yükleniyor…','Namaz takvimi alınamadı',
  'Yeniden dene','İnternet bağlantını kontrol edip yeniden dene.','place.stateName',
  'günün vakitleri hazır','Yayımlanmış veri bekleniyor'])
  assert.ok(screen.includes(copy),'calendar lost information: '+copy);
assert.match(screen,/<SafeAreaView edges=\{\['top','bottom'\]\}/);
// A 360×800 dp phone (3-button navigation, ~650 dp below the header) shows
// all thirty dates closed, and every name fits its cell at one size.
{
  const num=name=>Number(screen.match(new RegExp('const '+name+'=([0-9.]+);'))?.[1]);
  const type=Object.fromEntries([...screen.match(/const TYPE=\{([^}]*)\}/)[1]
    .matchAll(/(\w+):([\d.]+)/g)].map(([,k,v])=>[k,+v]));
  const em=Object.fromEntries([...screen.match(/const WIDEST_EM=\{([^}]*)\}/)[1]
    .matchAll(/(\w+):([\d.]+)/g)].map(([,k,v])=>[k,+v]));
  const [gap,edge,line,pad,rows]=[num('GAP'),num('EDGE'),num('LINE'),num('CELL_PAD'),30/num('PER_ROW')];
  assert.ok(gap>0&&edge>0&&line>=1.2&&pad>0&&rows===10,'calendar constants missing');
  assert.ok(screen.includes('const least=Math.ceil((hijri+date+weekday)*LINE+CELL_PAD*2+EDGE*2);'),
    'cell height formula changed: re-check the 360×800 fit below');
  const cell=(344-gap*2)/3,inner=cell-2*edge-10;
  const sizes=['hijri','date','weekday'].map(k=>Math.min(type[k],inner/em[k]));
  const least=Math.ceil(sizes.reduce((a,b)=>a+b,0)*line+pad*2+edge*2);
  assert.ok(rows*least+gap*(rows-1)<=650,'thirty dates no longer fit one 360×800 screen ('+least+')');
  assert.ok(sizes[0]>=10.5&&sizes[1]>=11.5,'dates read too small on a 360 dp phone');
  // "29 Cemaziyelevvel" is ~8.4 em in a bold system face: the margin holds.
  assert.ok(em.hijri>=8.8&&em.date>=8&&em.weekday>=5,'widest-name margins shrank');
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
console.log('Calendar 3.0: thirty dates on one page in three columns, a tapped date opens its six clocks under its row on a tab, one text size per role, lazy verified days, home cards, routed screens and Diyanet annual events OK');
