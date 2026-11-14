import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MIRROR_SOURCE,parseMirrorStates,parseMirrorCities,parseMirrorTriplet,
  validateCachedMirrorTriplet,DEFAULT_MIRROR_PLACE,MIRROR_CACHE_MS,
} from './mirrorCalendar.ts';
const date='2026-11-14',city=9541,fetchTime='2026-11-14T08:00:00.000Z';
const day=(n:number):Record<string,unknown>=>({
  tarih:'2026-11-'+String(13+n).padStart(2,'0'),
  hicri:'5 Cemaziyelahir 1448',
  imsak:'06:15',gunes:'07:43',ogle:'12:53',ikindi:'15:30',aksam:'17:54',yatsi:'19:17',
});
const raw={ok:true,data:{ilce:9541,kaynak:'Diyanet İşleri Başkanlığı',
  gunler:[day(0),day(1),day(2)]}};
test('free mirror district directory is parsed as separate from official API',()=>{
 const states=parseMirrorStates({ok:true,data:[
  {ad:'İstanbul',ilce:9541,sehir:539},{ad:'Ankara',ilce:9206,sehir:506},
 ]});
 assert.equal(states[0].name,'Ankara');
 assert.deepEqual(DEFAULT_MIRROR_PLACE,{id:9541,name:'İstanbul',stateId:539,stateName:'İstanbul'});
 assert.equal(parseMirrorCities({ok:true,data:[{ad:'İstanbul',ilce:9541}]},539)[0].id,9541);
});
test('mirror data produces strictly typed real-time triplet with independent source',()=>{
 const t=parseMirrorTriplet(raw,city,date,'İstanbul',fetchTime);
 assert.equal(t.source,MIRROR_SOURCE);
 assert.equal(t.today.times[0].time,'06:15');
 assert.equal(t.today.isDemo,false);
 assert.equal(t.previous.dateISO,'2026-11-13');
 assert.equal(t.next.dateISO,'2026-11-15');
 assert.notEqual(t.source,'diyanet-awqat-salah');
 assert.equal(validateCachedMirrorTriplet(t,city,date,Date.parse(fetchTime)+1000).today.dateISO,date);
});
test('mirror validation rejects fabricated dates, missing source and impossible time order',()=>{
 assert.throws(()=>parseMirrorTriplet({...raw,data:{...raw.data,kaynak:'Unknown'}},city,date,'İstanbul',fetchTime));
 assert.throws(()=>parseMirrorTriplet({...raw,data:{...raw.data,gunler:[day(1),day(2)]}},city,date,'İstanbul',fetchTime));
 assert.throws(()=>parseMirrorTriplet({...raw,data:{...raw.data,gunler:[day(0),{...day(1),aksam:'11:00'},day(2)]}},city,date,'İstanbul',fetchTime));
});
test('mirror local cache expires according to public service terms',()=>{
 const t=parseMirrorTriplet(raw,city,date,'İstanbul',fetchTime);
 const epoch=Date.parse(fetchTime);
 assert.ok(validateCachedMirrorTriplet(t,city,date,epoch+MIRROR_CACHE_MS-100));
 assert.throws(()=>validateCachedMirrorTriplet(t,city,date,epoch+MIRROR_CACHE_MS+1));
 assert.throws(()=>validateCachedMirrorTriplet({...t,source:'diyanet-awqat-salah'},city,date,epoch+1000));
});
