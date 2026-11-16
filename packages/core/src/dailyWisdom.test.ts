import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyWisdom,DAILY_WISDOM_PAIRS,QURAN_SELECTIONS,HADITH_SELECTIONS,WISDOM_LIBRARY,wisdomById} from './dailyWisdom.ts';

test('all 30 authored day-pairs have full text and document references',()=>{
  assert.equal(DAILY_WISDOM_PAIRS.length,30);
  assert.equal(QURAN_SELECTIONS.length,30);
  assert.equal(HADITH_SELECTIONS.length,30);
  assert.equal(WISDOM_LIBRARY.length,60);
  const ids=new Set<string>();
  for(const [index,pair] of DAILY_WISDOM_PAIRS.entries()){
    assert.equal(pair.day,index+1);
    for(const item of [pair.verse,pair.hadith]){
      assert.equal(item.day,pair.day);
      assert.ok(item.text.length>25,'Missing full text: '+item.id);
      assert.ok(item.reference.length>12,'Missing reference: '+item.id);
      assert.ok(!ids.has(item.id),'Duplicate item: '+item.id);
      ids.add(item.id);
      assert.equal(wisdomById(item.id),item);
    }
  }
  assert.equal(wisdomById('not-found'),null);
  assert.equal(QURAN_SELECTIONS[0].reference,'Bakara Suresi, 43. Ayet-i Celile');
  assert.equal(HADITH_SELECTIONS[29].reference,'Tirmizî, İlim, 14');
});
test('30-day paired order repeats together on day 31',()=>{
  assert.equal(dailyWisdom('2026-11-16').day,1);
  assert.equal(dailyWisdom('2026-12-15').day,30);
  assert.equal(dailyWisdom('2026-12-16').day,1);
  assert.equal(dailyWisdom('2027-01-14').day,30);
  for(let i=0;i<150;i++){
    const iso=new Date(Date.UTC(2026,10,16+i)).toISOString().slice(0,10);
    const later=new Date(Date.UTC(2026,10,16+i+30)).toISOString().slice(0,10);
    const a=dailyWisdom(iso),b=dailyWisdom(later);
    assert.equal(a.verse.id,b.verse.id);
    assert.equal(a.hadith.id,b.hadith.id);
    assert.equal(a.verse.day,a.hadith.day);
    assert.equal(a.day,i%30+1);
  }
});
test('day-24 editorial explanation is separated from the Qur’an excerpt',()=>{
  assert.ok(!QURAN_SELECTIONS[23].text.includes('cennet misal camilerin'));
  assert.ok(QURAN_SELECTIONS[23].note?.includes('cennet misal camilerin'));
  assert.ok(HADITH_SELECTIONS[23].text.includes('Tirmizî’nin Sünen’deki rivayeti'));
});
test('invalid dates never select silent fallbacks',()=>{
  assert.deepEqual(dailyWisdom('2026-11-16'),dailyWisdom('2026-11-16'));
  assert.throws(()=>dailyWisdom('2026-14-99'));
  assert.throws(()=>dailyWisdom('invalid'));
});
