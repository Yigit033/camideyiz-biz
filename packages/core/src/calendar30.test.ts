import test from 'node:test';
import assert from 'node:assert/strict';
import {
 parseCalendar30Source,mergeCalendar30,calendar30Coverage,
 validateCalendar30Cache,shiftCalendarDate,
} from './calendar30.ts';
const ID=9545,START='2026-12-20',STAMP='2026-12-20T12:00:00.000Z';
const times=['06:10','07:42','12:55','15:28','17:51','19:15'];
const keys=['imsak','gunes','ogle','ikindi','aksam','yatsi'];
const names=['Imsak','Gunes','Ogle','Ikindi','Aksam','Yatsi'];
function iso(i:number){return shiftCalendarDate(START,i);}
function primary(i:number):Record<string,unknown>{
 return {tarih:iso(i),hicri:'10 Cemaziyelahir 1448',
   ...Object.fromEntries(keys.map((k,j)=>[k,times[j]]))};
}
function backup(i:number):Record<string,unknown>{
 const x=iso(i);
 return {MiladiTarihKisa:x.slice(8)+'.'+x.slice(5,7)+'.'+x.slice(0,4),
   HicriTarihUzun:'10 Cemaziyelahir 1448',
   ...Object.fromEntries(names.map((k,j)=>[k,times[j]]))};
}
const mirror=(list:unknown[])=>({ok:true,data:{ilce:ID,kaynak:'Diyanet İşleri Başkanlığı',gunler:list}});
test('year boundary gives exactly 30 Gregorian dates, no timezone off-by-one',()=>{
 assert.equal(iso(0),START);
 assert.equal(iso(12),'2027-01-01');
 assert.equal(iso(29),'2027-01-18');
 const x=parseCalendar30Source(Array.from({length:30},(_,i)=>backup(i)),
   'mtopal',ID,START,STAMP);
 assert.equal(x.days.length,30);
 assert.equal(calendar30Coverage(x),30);
 assert.equal(x.days[12]?.dateISO,'2027-01-01');
 assert.equal(x.days[29]?.times[5].time,'19:15');
});
test('separate monthly publishers merge only actual whole-day rows',()=>{
 const first=parseCalendar30Source(mirror(Array.from({length:12},(_,i)=>primary(i))),
   'idamedya',ID,START,STAMP);
 const second=parseCalendar30Source(Array.from({length:19},(_,i)=>backup(i+11)),
   'mtopal',ID,START,STAMP);
 const merged=mergeCalendar30([first,second]);
 assert.equal(calendar30Coverage(merged),30);
 assert.equal(merged.days[11]?.provider,'idamedya');
 assert.equal(merged.days[12]?.provider,'mtopal');
});
test('partial coverage never fills missing dates with invented prayer hours',()=>{
 const a=parseCalendar30Source(mirror([primary(0),primary(5)]),'idamedya',ID,START,STAMP);
 assert.equal(calendar30Coverage(a),2);
 assert.equal(a.days[1],null);
 assert.equal(a.days[5]?.dateISO,iso(5));
});
test('primary source must explicitly authenticate its district and claimed publisher',()=>{
 assert.throws(()=>parseCalendar30Source(mirror([primary(0)]),'idamedya',8888,START,STAMP));
 assert.throws(()=>parseCalendar30Source({data:{ilce:ID,kaynak:'untrusted',gunler:[primary(0)]}},
   'idamedya',ID,START,STAMP));
});
test('reject reverse clock order, invalid dates, duplicates, malformed published clocks',()=>{
 assert.throws(()=>parseCalendar30Source([backup(0),backup(0)],'mtopal',ID,START,STAMP));
 assert.throws(()=>parseCalendar30Source([{...backup(0),Aksam:'11:00'}],
   'mtopal',ID,START,STAMP));
 assert.throws(()=>parseCalendar30Source([{...backup(0),MiladiTarihKisa:'31.02.2027'}],
   'mtopal',ID,START,STAMP));
 assert.throws(()=>parseCalendar30Source(mirror([{...primary(0),imsak:'6:10'}]),
   'idamedya',ID,START,STAMP));
});
test('official cached rows have strict source, six-key order and correct district',()=>{
 const good={
   dateISO:START,cityId:ID,source:'diyanet-awqat-salah',
   timezone:'Europe/Istanbul',times:keys.map((k,i)=>({key:k,label:k,time:times[i]})),
   hijriDate:null,
 };
 const parsed=parseCalendar30Source([good],'diyanet-awqat-salah',ID,START,STAMP);
 assert.equal(parsed.days[0]?.provider,'diyanet-awqat-salah');
 assert.throws(()=>parseCalendar30Source([{...good,cityId:99}],
   'diyanet-awqat-salah',ID,START,STAMP));
 assert.throws(()=>parseCalendar30Source([{...good,times:good.times.slice().reverse()}],
   'diyanet-awqat-salah',ID,START,STAMP));
});
test('saved cache verifies 30 positions, source and TTL before rendering',()=>{
 const a=parseCalendar30Source(mirror([primary(0),primary(1)]),
  'idamedya',ID,START,STAMP);
 assert.equal(validateCalendar30Cache(a,ID,START,Date.parse(STAMP)+1000).days[1]?.dateISO,iso(1));
 assert.throws(()=>validateCalendar30Cache(a,ID+1,START,Date.parse(STAMP)+1000));
 assert.throws(()=>validateCalendar30Cache(a,ID,START,Date.parse(STAMP)+2*86_400_000));
 const corrupt={...a,days:[...a.days]};
 corrupt.days[0]={...a.days[0]!,cityId:ID+1};
 assert.throws(()=>validateCalendar30Cache(corrupt,ID,START,Date.parse(STAMP)+1000));
});
test('merge rejects a calendar belonging to another date or district',()=>{
 const a=parseCalendar30Source(mirror([primary(0)]),'idamedya',ID,START,STAMP);
 assert.throws(()=>mergeCalendar30([a,{...a,startISO:'2026-12-21'}]));
 assert.throws(()=>mergeCalendar30([a,{...a,cityId:ID+1}]));
});
