import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_SCHEDULE} from './prayer.ts';
import {indicativeKerahatWindows} from './timeline.ts';
import {
  prayerSectorLabelAngle,kerahatRingWindows,KERAHAT_APPROACH_SECONDS,
} from './prayerWheelPresentation.ts';
import {makeVisualDialSectors} from './visualDial.ts';

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
    assert.ok(angle-sector.from>=12,'leave clock-to-label breathing room');
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
