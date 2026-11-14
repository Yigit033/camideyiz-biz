import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MIRROR_SOURCE,parseMirrorStates,parseMirrorCities,parseMirrorTriplet,
  validateCachedMirrorTriplet,DEFAULT_MIRROR_PLACE,MIRROR_CACHE_MS,calculateMirrorPhase,
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
 assert.throws(()=>parseMirrorTriplet({...raw,data:{...raw.data,gunler:[day(0),day(2)]}},city,date,'İstanbul',fetchTime));
 assert.throws(()=>parseMirrorTriplet({...raw,data:{...raw.data,gunler:[day(0),{...day(1),aksam:'11:00'},day(2)]}},city,date,'İstanbul',fetchTime));
});
test('mirror local cache expires according to public service terms',()=>{
 const t=parseMirrorTriplet(raw,city,date,'İstanbul',fetchTime);
 const epoch=Date.parse(fetchTime);
 assert.ok(validateCachedMirrorTriplet(t,city,date,epoch+MIRROR_CACHE_MS-100));
 assert.throws(()=>validateCachedMirrorTriplet(t,city,date,epoch+MIRROR_CACHE_MS+1));
 assert.throws(()=>validateCachedMirrorTriplet({...t,source:'diyanet-awqat-salah'},city,date,epoch+1000));
});


// Regression fixture follows the actual public endpoint:
/// https://idamedya.org/api/v1/namaz/9541
// 14 Nov 2026 response starts on 14 Nov, without 13 Nov.
const realProviderToday={
  tarih:'2026-11-14',hicri:'5 Cemaziyelahir 1448',
  imsak:'06:15',gunes:'07:43',ogle:'12:53',ikindi:'15:30',aksam:'17:54',yatsi:'19:17',
};
const realProviderTomorrow={
  tarih:'2026-11-15',hicri:'6 Cemaziyelahir 1448',
  imsak:'06:16',gunes:'07:44',ogle:'12:54',ikindi:'15:29',aksam:'17:53',yatsi:'19:16',
};
const liveShape={
  ok:true,data:{
    yer:'İstanbul',ilce:9541,kaynak:'Diyanet İşleri Başkanlığı',
    gunler:[realProviderToday,realProviderTomorrow,
      {...realProviderTomorrow,tarih:'2026-11-16'}],
  },
};
test('REGRESSION: today-first Idamedya response does not need nonexistent yesterday',()=>{
  const triplet=parseMirrorTriplet(liveShape,9541,'2026-11-14','İstanbul',fetchTime);
  assert.equal(triplet.previous,null);
  assert.equal(triplet.today.times[0].time,'06:15');
  assert.equal(triplet.today.times[2].time,'12:53');
  assert.equal(triplet.today.times[4].time,'17:54');
  assert.equal(triplet.next.times[0].time,'06:16');
  assert.equal(validateCachedMirrorTriplet(triplet,9541,'2026-11-14',
    Date.parse(fetchTime)+1000).previous,null);
});
test('12:50 Istanbul shows actual afternoon next event and 3-minute countdown',()=>{
  const t=parseMirrorTriplet(liveShape,9541,'2026-11-14','İstanbul',fetchTime);
  const phase=calculateMirrorPhase(t.previous,t.today,t.next,12*3600+50*60);
  assert.equal(phase.current.key,'gunes');
  assert.equal(phase.next.key,'ogle');
  assert.equal(phase.secondsRemaining,180);
  assert.equal(phase.urgency,'imminent');
});
test('after Isha, countdown uses tomorrow published Imsak and correct day rollover',()=>{
  const t=parseMirrorTriplet(liveShape,9541,'2026-11-14','İstanbul',fetchTime);
  const phase=calculateMirrorPhase(t.previous,t.today,t.next,21*3600);
  assert.equal(phase.current.key,'yatsi');
  assert.equal(phase.next.key,'imsak');
  assert.equal(phase.secondsRemaining,(24+6)*3600+16*60-21*3600);
  assert.ok(phase.progress>0&&phase.progress<1);
});
test('before first Imsak with missing yesterday: accurate countdown, no fabricated progress',()=>{
  const t=parseMirrorTriplet(liveShape,9541,'2026-11-14','İstanbul',fetchTime);
  const phase=calculateMirrorPhase(t.previous,t.today,t.next,5*3600);
  assert.equal(phase.next.key,'imsak');
  assert.equal(phase.secondsRemaining,75*60);
  assert.equal(phase.progress,0);
});
test('reject responses without tomorrow, wrong source, or corrupt cache fields',()=>{
  assert.throws(()=>parseMirrorTriplet({
    ...liveShape,data:{...liveShape.data,gunler:[realProviderToday]},
  },9541,date,'İstanbul',fetchTime));
  assert.throws(()=>parseMirrorTriplet({
    ...liveShape,data:{...liveShape.data,kaynak:'test'},
  },9541,date,'İstanbul',fetchTime));
  const t=parseMirrorTriplet(liveShape,9541,date,'İstanbul',fetchTime);
  const fake={...t,today:{...t.today,times:[...t.today.times.slice(0,2),
    {...t.today.times[2],time:'23:59'},...t.today.times.slice(3)]}};
  assert.throws(()=>validateCachedMirrorTriplet(fake,9541,date,Date.parse(fetchTime)+1000));
});


test('forward published calendar is kept for up to 16 consecutive days',()=>{
  const fixture={
    ok:true,data:{ilce:9541,kaynak:'Diyanet İşleri Başkanlığı',
      gunler:Array.from({length:15},(_,index)=>{
        const date=new Date(Date.UTC(2026,10,14+index)).toISOString().slice(0,10);
        return {...realProviderToday,tarih:date};
      }),
    },
  };
  const selection=parseMirrorTriplet(fixture,9541,'2026-11-14','İstanbul',fetchTime);
  assert.equal(selection.upcoming.length,15);
  assert.equal(selection.upcoming[14].dateISO,'2026-11-28');
  assert.equal(validateCachedMirrorTriplet(selection,9541,'2026-11-14',
    Date.parse(fetchTime)+5000).upcoming.length,15);
});
test('future cached prayer entries must be chronological and correctly attributed',()=>{
  const triplet=parseMirrorTriplet(liveShape,9541,'2026-11-14','İstanbul',fetchTime);
  const tampered={...triplet,upcoming:[triplet.upcoming[0],
    {...triplet.upcoming[1],cityId:1111}]};
  assert.throws(()=>validateCachedMirrorTriplet(tampered,9541,'2026-11-14',
    Date.parse(fetchTime)+1000));
});
