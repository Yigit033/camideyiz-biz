import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_SCHEDULE} from './prayer.ts';
import {indicativeKerahatWindows} from './timeline.ts';
import {
  prayerSectorLabelAngle,prayerSectorVisualLayout,currentPrayerArc,
  kerahatRingWindows,KERAHAT_APPROACH_SECONDS,
} from './prayerWheelPresentation.ts';
import {makeVisualDialSectors,clockSecondsToVisualAngle} from './visualDial.ts';

const schedule={...DEMO_SCHEDULE,isDemo:false,dateISO:'2026-11-15',
  times:[
    {key:'imsak' as const,label:'İmsak',time:'06:15'},
    {key:'gunes' as const,label:'Güneş',time:'07:42'},
    {key:'ogle' as const,label:'Öğle',time:'12:52'},
    {key:'ikindi' as const,label:'İkindi',time:'15:28'},
    {key:'aksam' as const,label:'Akşam',time:'17:52'},
    {key:'yatsi' as const,label:'Yatsı',time:'19:15'},
  ],
};
const sec=(hh:number,mm:number)=>hh*3600+mm*60;
const windows=indicativeKerahatWindows(schedule);
test('P1 sector labels move toward the relevant start clock without crossing a wedge boundary',()=>{
  const sectors=makeVisualDialSectors(schedule.times);
  assert.equal(sectors.length,6);
  for(const sector of sectors){
    const angle=prayerSectorLabelAngle(sector.from,sector.to);
    const middle=(sector.from+sector.to)/2;
    assert.ok(angle>sector.from,'label must remain inside');
    assert.ok(angle<sector.to,'label must remain inside');
    assert.ok(angle<=middle+0.001,'label moves toward clock rather than wedge tail');
    const span=sector.to-sector.from;
    assert.ok(angle-sector.from>=Math.min(12,span*.38),
      'keep label inside even a short proportional prayer wedge');
  }
  const tiny=prayerSectorLabelAngle(80,86);
  assert.ok(tiny>80&&tiny<83,
    'even a very narrow valid wedge keeps its caption inside the boundary');
  assert.throws(()=>prayerSectorLabelAngle(36,32));
});
test('P1 kerahat ring has a 20m amber approach and burgundy active band at exact bounds',()=>{
  const sunrise=windows[0];
  const before=kerahatRingWindows(windows,sunrise.startSeconds-20*60-1);
  assert.equal(before[0].state,'inactive');
  assert.equal(kerahatRingWindows(windows,sunrise.startSeconds-20*60)[0].state,'approaching');
  assert.equal(kerahatRingWindows(windows,sunrise.startSeconds-1)[0].state,'approaching');
  assert.equal(kerahatRingWindows(windows,sunrise.startSeconds)[0].state,'active');
  assert.equal(kerahatRingWindows(windows,sunrise.endSeconds-1)[0].state,'active');
  assert.equal(kerahatRingWindows(windows,sunrise.endSeconds)[0].state,'inactive');
  assert.equal(KERAHAT_APPROACH_SECONDS,1200);
});
test('sunrise, zenith and sunset warnings are independent, approximate and date-sensitive',()=>{
  assert.deepEqual(windows.map(w=>w.kind),['sunrise','zenith','sunset']);
  assert.equal(kerahatRingWindows(windows,sec(12,35))[1].state,'approaching');
  assert.equal(kerahatRingWindows(windows,sec(12,44))[1].state,'active');
  assert.equal(kerahatRingWindows(windows,sec(17,10))[2].state,'active');
  assert.ok(kerahatRingWindows(windows,sec(21,0)).every(w=>w.state==='inactive'));
  assert.equal(kerahatRingWindows([],sec(17,10)).length,0,
    'hidden or unavailable kerahat produces NO warning without source data');
  assert.throws(()=>kerahatRingWindows(windows,-1));
  assert.throws(()=>kerahatRingWindows(windows,86400));
  assert.throws(()=>kerahatRingWindows(windows,sec(12,0),-1));
});

test('boundary clock labels are centered exactly on separators and entirely inside the wheel',()=>{
  const sectors=makeVisualDialSectors(schedule.times);
  for(const s of sectors){
    const layout=prayerSectorVisualLayout(s.from,s.to);
    assert.equal(layout.clockAngle,s.from);
    assert.ok(layout.clockRadius+layout.clockHeight/2<169,
      'clock badges must remain inside outer coloured rim');
    assert.ok(layout.clockRadius-layout.clockHeight/2>108,
      'clock badges must not cross into center medallion');
    assert.ok(layout.labelAngle>s.from&&layout.labelAngle<s.to,
      'icons/names stay within their own angular sector');
  }
  assert.ok(prayerSectorVisualLayout(175,196).fontSize<
    prayerSectorVisualLayout(196,360).fontSize);
});

test('outer progress tracks active wedge only, including actual next-day İmsak',()=>{
  const sectors=makeVisualDialSectors(schedule.times);
  const p=currentPrayerArc(sec(21,11),schedule.times,sectors,'19:14','06:16')!;
  assert.equal(p.sectorIndex,5);
  assert.equal(p.from,sectors[5].from);
  assert.equal(p.to,360);
  assert.ok(Math.abs(p.progress-116/661)<1e-12);
  assert.ok(p.progressAngle>p.from&&p.progressAngle<p.to);

  const beforeImsak=currentPrayerArc(sec(5,45),schedule.times,sectors,'19:14','06:16')!;
  assert.equal(beforeImsak.sectorIndex,5);
  assert.ok(Math.abs(beforeImsak.progress-631/661)<1e-12);
  assert.ok(beforeImsak.progressAngle<360);

  const atImsak=currentPrayerArc(sec(6,15),schedule.times,sectors,'19:14','06:16')!;
  assert.equal(atImsak.sectorIndex,0);
  assert.equal(atImsak.progress,0);
  const atSunrise=currentPrayerArc(sec(7,42),schedule.times,sectors)!;
  assert.equal(atSunrise.sectorIndex,1);
  assert.equal(atSunrise.progress,0);
  assert.equal(currentPrayerArc(0,[],[]),null);
});

test('kerahat windows retain exact 24-hour proportional dial angles',()=>{
  const sectors=makeVisualDialSectors(schedule.times);

  for(const w of windows){
    const from=clockSecondsToVisualAngle(w.startSeconds,schedule.times,sectors);
    const to=clockSecondsToVisualAngle(w.endSeconds,schedule.times,sectors);
    assert.ok(Math.abs((to-from)-(w.endSeconds-w.startSeconds)/86400*360)<1e-8);
  }
});
