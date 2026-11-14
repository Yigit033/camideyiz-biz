import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDiyanetDay,parseDiyanetList,parsePlace,assertISODate} from './diyanet.ts';
const raw={
  fajr:'06:11',sunrise:'07:42',dhuhr:'12:38',asr:'15:01',maghrib:'17:23',isha:'18:49',
  hijriDateLong:'5 Cemaziyelevvel 1444',
  gregorianDateLongIso8601:'2026-11-14T00:00:00.0000000+03:00',
  greenwichMeanTimeZone:3,
};
test('official field mapping preserves six ordered Turkish prayer labels',()=>{
  const r=parseDiyanetDay(raw,123,'Kadıköy','2026-11-14T10:00:00Z');
  assert.equal(r.isDemo,false);
  assert.equal(r.source,'diyanet-awqat-salah');
  assert.equal(r.dateISO,'2026-11-14');
  assert.equal(r.times[0].time,'06:11');
  assert.equal(r.times[5].key,'yatsi');
  assert.equal(r.timezone,'Europe/Istanbul');
});
test('bad days and malformed provider payloads fail closed',()=>{
  assert.throws(()=>parseDiyanetDay({...raw,maghrib:'06:01'},123,'İstanbul',new Date().toISOString()));
  assert.throws(()=>parseDiyanetDay({...raw,gregorianDateLongIso8601:'2026-02-30T00:00:00+03:00'},123,'İstanbul',new Date().toISOString()));
  assert.throws(()=>parseDiyanetDay({...raw,greenwichMeanTimeZone:2},123,'İstanbul',new Date().toISOString()));
  assert.throws(()=>parseDiyanetDay({...raw,fajr:'xx'},123,'İstanbul',new Date().toISOString()));
  assert.throws(()=>assertISODate('2026-11-31'));
});
test('provider data envelope and official place IDs are validated',()=>{
  assert.equal(parseDiyanetList({success:true,data:[{id:2,name:'TÜRKİYE'}]}).length,1);
  assert.throws(()=>parseDiyanetList({success:false,data:[]}));
  assert.deepEqual(parsePlace({id:34,name:' İstanbul '},2),{id:34,name:'İstanbul',stateId:2});
  assert.throws(()=>parsePlace({id:'abc',name:'İstanbul'}));
});
