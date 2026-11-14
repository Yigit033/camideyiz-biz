import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_SCHEDULE} from './prayer.ts';
import {DEFAULT_KERAHAT_SETTINGS,getKerahatView,validateKerahatSettings,
  formatWindowClock,KERAHAT_SOURCE_URL} from './kerahat.ts';

const istanbul={...DEMO_SCHEDULE,isDemo:false,dateISO:'2026-11-14',
  times:[
    {key:'imsak' as const,label:'İmsak',time:'06:15'},
    {key:'gunes' as const,label:'Güneş',time:'07:43'},
    {key:'ogle' as const,label:'Öğle',time:'12:53'},
    {key:'ikindi' as const,label:'İkindi',time:'15:30'},
    {key:'aksam' as const,label:'Akşam',time:'17:54'},
    {key:'yatsi' as const,label:'Yatsı',time:'19:17'},
  ],
};
const sec=(h:number,m:number)=>h*3600+m*60;
test('real Istanbul calendar produces three visibly separate approximate windows',()=>{
 const result=getKerahatView(istanbul,'2026-11-14',sec(8,0));
 assert.deepEqual(result.windows.map(w=>[w.kind,
   formatWindowClock(w.startSeconds),formatWindowClock(w.endSeconds)]),[
     ['sunrise','07:43','08:28'],
     ['zenith','12:43','12:53'],
     ['sunset','17:09','17:54'],
   ]);
 assert.equal(result.active?.kind,'sunrise');
 assert.equal(result.next?.kind,'zenith');
 assert.ok(KERAHAT_SOURCE_URL.startsWith('https://kurul.diyanet.gov.tr/'));
});
test('travel selection follows actual selected city clock times, not a fixed Istanbul interval',()=>{
 const moved={...istanbul,locationName:'Ankara',times:istanbul.times.map(t=>{
   const [h,m]=t.time.split(':').map(Number);
   const minute=h*60+m-20;
   return {...t,time:String(Math.floor(minute/60)).padStart(2,'0')+':'+
     String(minute%60).padStart(2,'0')};
 })};
 const result=getKerahatView(moved,'2026-11-14',sec(8,0));
 assert.equal(formatWindowClock(result.windows[0].startSeconds),'07:23');
 assert.equal(formatWindowClock(result.windows[1].endSeconds),'12:33');
});
test('personal offsets affect visual windows but never prayer times',()=>{
 const values={mode:'custom' as const,sunriseMinutes:50,preNoonMinutes:5,preSunsetMinutes:40};
 const output=getKerahatView(istanbul,'2026-11-14',sec(8,32),values);
 assert.equal(output.isCustom,true);
 assert.equal(output.active?.kind,'sunrise');
 assert.equal(formatWindowClock(output.windows[0].endSeconds),'08:33');
 assert.equal(formatWindowClock(output.windows[1].startSeconds),'12:48');
 assert.equal(formatWindowClock(output.windows[2].startSeconds),'17:14');
 assert.equal(istanbul.times[1].time,'07:43');
});
test('invalid or unsafe manual configuration is rejected before persistence',()=>{
 assert.deepEqual(validateKerahatSettings(DEFAULT_KERAHAT_SETTINGS),DEFAULT_KERAHAT_SETTINGS);
 for(const amount of [-1,39,51,NaN,44.5,Infinity])
  assert.throws(()=>validateKerahatSettings({...DEFAULT_KERAHAT_SETTINGS,sunriseMinutes:amount}));
 assert.throws(()=>validateKerahatSettings({...DEFAULT_KERAHAT_SETTINGS,mode:'official'}));
 assert.throws(()=>formatWindowClock(86400));
});
test('demo, stale or hidden input never produces live kerahat markers',()=>{
 assert.equal(getKerahatView(DEMO_SCHEDULE,DEMO_SCHEDULE.dateISO,sec(8,0)).windows.length,0);
 assert.equal(getKerahatView(istanbul,'2026-11-13',sec(8,0)).windows.length,0);
 assert.equal(getKerahatView(istanbul,'2026-11-14',sec(8,0),
   {...DEFAULT_KERAHAT_SETTINGS,mode:'hidden'}).windows.length,0);
});
test('active warning starts and ends at exact configured clock boundaries',()=>{
 assert.equal(getKerahatView(istanbul,'2026-11-14',sec(7,42)).active,null);
 assert.equal(getKerahatView(istanbul,'2026-11-14',sec(7,43)).active?.kind,'sunrise');
 assert.equal(getKerahatView(istanbul,'2026-11-14',sec(8,28)).active,null);
 assert.equal(getKerahatView(istanbul,'2026-11-14',sec(12,43)).active?.kind,'zenith');
 assert.equal(getKerahatView(istanbul,'2026-11-14',sec(17,54)).active,null);
});
