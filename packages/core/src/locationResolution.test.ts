import test from 'node:test';
import assert from 'node:assert/strict';
import {normaliseTurkishPlace,findExactTurkishPlace,locationTravelMeters}
  from './locationResolution.ts';
test('GPS city and district matching is exact and tolerant of Turkish/transliterated spellings',()=>{
  const provinces=[
    {id:539,name:'İSTANBUL'},
    {id:557,name:'MERSİN'},
    {id:510,name:'ANKARA'},
  ];
  const districts=[
    {id:9551,name:'TUZLA'},
    {id:9545,name:'PENDİK'},
    {id:9541,name:'KADIKÖY'},
    {id:9477,name:'ÜSKÜDAR'},
  ];
  assert.equal(findExactTurkishPlace(['Istanbul Province'],provinces)?.id,539);
  assert.equal(findExactTurkishPlace(['İstanbul İli'],provinces)?.id,539);
  assert.equal(findExactTurkishPlace(['Mersin'],provinces)?.id,557);
  assert.equal(findExactTurkishPlace(['Tuzla ilçesi'],districts)?.id,9551);
  assert.equal(findExactTurkishPlace(['PENDIK'],districts)?.id,9545);
  assert.equal(findExactTurkishPlace(['Kadikoy'],districts)?.id,9541);
  assert.equal(normaliseTurkishPlace('Çankaya İlçesi'),'cankaya');
});
test('GPS must never infer a neighboring district, province centre, or neighbourhood',()=>{
  const districts=[{id:9551,name:'Tuzla'},{id:9545,name:'Pendik'}];
  assert.equal(findExactTurkishPlace(['Aydınlı Mahallesi'],districts),null);
  assert.equal(findExactTurkishPlace(['Tuzla/Pendik'],districts),null);
  assert.equal(findExactTurkishPlace(['İstanbul'],districts),null);
  assert.equal(findExactTurkishPlace([null,undefined,''],districts),null);
});
test('GPS geocoding movement threshold is geographically bounded',()=>{
  const a={latitude:40.817,longitude:29.3};
  const b={latitude:40.818,longitude:29.301};
  const moved={latitude:40.853,longitude:29.33};
  assert.ok(locationTravelMeters(a,b)<2000);
  assert.ok(locationTravelMeters(a,moved)>2000);
  assert.equal(locationTravelMeters(a,a),0);
  assert.throws(()=>locationTravelMeters(
    {latitude:1000,longitude:29},a),RangeError);
});
