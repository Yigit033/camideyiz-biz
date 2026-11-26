import test from 'node:test';
import assert from 'node:assert/strict';
import {RELIGIOUS_DAYS,religiousDaysFrom,upcomingReligiousDay,religiousDayYears} from './religiousDays.ts';
test('only Diyanet-published 2026 and 2027 records, sorted, identifiable',()=>{
 assert.deepEqual(religiousDayYears(),[2026,2027]);
 assert.ok(RELIGIOUS_DAYS.length>28);
 assert.equal(new Set(RELIGIOUS_DAYS.map(d=>d.id)).size,RELIGIOUS_DAYS.length);
 for(let i=1;i<RELIGIOUS_DAYS.length;i++)
   assert.ok(RELIGIOUS_DAYS[i].dateISO>=RELIGIOUS_DAYS[i-1].dateISO);
 assert.ok(RELIGIOUS_DAYS.every(d=>d.sourceURL.startsWith('https://vakithesaplama.diyanet.gov.tr/')));
});
test('cross-year upcoming Regaib and 2027 Miraç use published Gregorian dates',()=>{
 assert.equal(upcomingReligiousDay('2026-11-20')?.dateISO,'2026-12-10');
 const next=religiousDaysFrom('2026-12-11');
 assert.equal(next[0].dateISO,'2027-01-04');
 assert.equal(next[0].title,'Miraç Kandili');
 assert.equal(religiousDaysFrom('2027-01-01',2026).length,0);
});
test('multiple events on 10 Dec and all 3/4 bayram days are retained',()=>{
 assert.deepEqual(RELIGIOUS_DAYS.filter(d=>d.dateISO==='2026-12-10')
   .map(d=>d.title).sort(),['Regaip Kandili','Üç Ayların Başlangıcı'].sort());
 assert.equal(RELIGIOUS_DAYS.filter(d=>d.dateISO>='2027-03-09'&&d.dateISO<='2027-03-11').length,3);
 assert.equal(RELIGIOUS_DAYS.filter(d=>d.dateISO>='2027-05-16'&&d.dateISO<='2027-05-19').length,4);
});
test('night observance is explicit rather than moving day forward',()=>{
 const x=RELIGIOUS_DAYS.find(d=>d.title==='Berat Kandili'&&d.dateISO.startsWith('2027'));
 assert.equal(x?.dateISO,'2027-01-22');
 assert.equal(x?.night,true);
 assert.equal(upcomingReligiousDay('2028-01-01'),null);
});
