import test from 'node:test';
import assert from 'node:assert/strict';
import {normaliseTurkishPlace,findExactTurkishPlace,locationTravelMeters,
  turkishPlaceKey,prettyTurkishPlace,withCentralDistricts,CENTRAL_DISTRICTS}
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
test('directory spellings never decide a match: suffixes, spacing, renames',()=>{
  const malatya=[{id:1,name:'KALE (M)'},{id:2,name:'MALATYA'}];
  assert.equal(findExactTurkishPlace(['Kale'],malatya)?.id,1);
  const bursa=[{id:3,name:'BÜYÜK ORHAN'},{id:4,name:'MUSTAFA KEMALPAŞA'}];
  assert.equal(findExactTurkishPlace(['Büyükorhan'],bursa)?.id,3);
  assert.equal(findExactTurkishPlace(['Mustafakemalpaşa'],bursa)?.id,4);
  assert.equal(findExactTurkishPlace(['Ondokuzmayıs'],[{id:5,name:'19 MAYIS'}])?.id,5);
  assert.equal(findExactTurkishPlace(['Marmaraereğlisi'],[{id:6,name:'M.EREĞLİSİ'}])?.id,6);
  assert.equal(turkishPlaceKey('Eyüp'),turkishPlaceKey('Eyüpsultan'));
  assert.equal(prettyTurkishPlace('KALE (M)'),'Kale (M)');
  assert.equal(prettyTurkishPlace('M.EREĞLİSİ'),'M.Ereğlisi');
  assert.equal(prettyTurkishPlace('PENDİK'),'Pendik');
});
test('central districts use the province-centre calendar and nothing else',()=>{
  const istanbul=[
    {id:9541,name:'İSTANBUL',state_id:539},
    {id:9545,name:'PENDİK',state_id:539},
    {id:9551,name:'TUZLA',state_id:539},
  ];
  const listed=withCentralDistricts('İSTANBUL',istanbul);
  const uskudar=findExactTurkishPlace(['Üsküdar'],listed);
  assert.deepEqual(uskudar,{id:9541,name:'Üsküdar',state_id:539});
  assert.equal(findExactTurkishPlace(['Kadıköy'],listed)?.id,9541);
  assert.equal(findExactTurkishPlace(['Eyüp'],listed)?.id,9541);
  // Districts with their own Diyanet calendar keep it.
  assert.equal(findExactTurkishPlace(['Pendik'],listed)?.id,9545);
  assert.equal(listed.length,istanbul.length+CENTRAL_DISTRICTS.istanbul.length);
  // Turkish alphabetical order, so Üsküdar sits after Tuzla.
  const names=listed.map(row=>row.name);
  assert.ok(names.indexOf('Üsküdar')>names.indexOf('TUZLA'));
  assert.ok(names.indexOf('Çankaya')<0);
  // A district Diyanet lists itself is never duplicated.
  const already=withCentralDistricts('İSTANBUL',[...istanbul,{id:1,name:'ÜSKÜDAR',state_id:539}]);
  assert.equal(already.filter(row=>turkishPlaceKey(row.name)==='uskudar').length,1);
  assert.equal(findExactTurkishPlace(['Üsküdar'],already)?.id,1);
  // "Merkez" (non-metropolitan centre) is a GPS spelling only.
  const bolu=[{id:9,name:'BOLU',state_id:518},{id:10,name:'GEREDE',state_id:518}];
  assert.equal(findExactTurkishPlace(['Merkez'],withCentralDistricts('BOLU',bolu)),null);
  assert.equal(findExactTurkishPlace(['Merkez'],withCentralDistricts('BOLU',bolu,{gps:true}))?.id,9);
  // Without a province-centre row nothing is invented.
  assert.deepEqual(withCentralDistricts('İSTANBUL',istanbul.slice(1)),istanbul.slice(1));
  // Every central district list stays free of duplicates.
  for(const [province,list] of Object.entries(CENTRAL_DISTRICTS)){
    assert.equal(new Set(list.map(turkishPlaceKey)).size,list.length,province);
  }
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
