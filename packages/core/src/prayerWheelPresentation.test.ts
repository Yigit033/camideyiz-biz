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
test('Prayer icons sit at the angular midpoint of their own sector',()=>{
  const sectors=makeVisualDialSectors(schedule.times);
  assert.equal(sectors.length,6);
  for(const sector of sectors){
    const angle=prayerSectorLabelAngle(sector.from,sector.to);
    const middle=(sector.from+sector.to)/2;
    assert.ok(angle>sector.from,'label must remain inside');
    assert.ok(angle<sector.to,'label must remain inside');
    assert.equal(angle,middle,'icon must be centered between separator angles');
    const span=sector.to-sector.from;
    assert.ok(angle-sector.from>=Math.min(12,span*.38),
      'keep label inside even a short proportional prayer wedge');
  }
  const tiny=prayerSectorLabelAngle(80,86);
  assert.ok(tiny>80&&tiny<84,
    'even a narrow wedge retains a centered icon');
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

test('separator time-name badges and center icons do not overlap on crowded six-prayer day',()=>{
  const sectors=makeVisualDialSectors(schedule.times);
  const polar=(deg:number,r:number)=>({
    x:180+r*Math.sin(deg*Math.PI/180),
    y:180-r*Math.cos(deg*Math.PI/180),
  });
  const boxes=sectors.flatMap((sector,i)=>{
    const v=prayerSectorVisualLayout(sector.from,sector.to);
    return [
      {type:'clock',i,point:polar(v.clockAngle,v.clockRadius),
        w:v.clockWidth,h:v.clockHeight},
      {type:'label',i,point:polar(v.labelAngle,v.labelRadius),
        w:v.labelWidth,h:v.labelHeight},
    ];
  });
  for(const label of boxes.filter(b=>b.type==='label')){
    for(const other of boxes){
      if(other===label||other.type==='label'&&other.i===label.i)continue;
      const dx=Math.abs(label.point.x-other.point.x);
      const dy=Math.abs(label.point.y-other.point.y);
      const overlapping=dx<(label.w+other.w)/2 &&
        dy<(label.h+other.h)/2;
      assert.equal(overlapping,false,
        'name/icon overlaps a clock or another name near '+schedule.times[label.i].label);
    }
  }
});

test('16 November 2026 wheel keeps icons separated from clock+name badges',()=>{
  const times=[
    {key:'imsak' as const,label:'İmsak',time:'06:16'},
    {key:'gunes' as const,label:'Güneş',time:'07:44'},
    {key:'ogle' as const,label:'Öğle',time:'12:52'},
    {key:'ikindi' as const,label:'İkindi',time:'15:28'},
    {key:'aksam' as const,label:'Akşam',time:'17:51'},
    {key:'yatsi' as const,label:'Yatsı',time:'19:14'},
  ];
  const sectors=makeVisualDialSectors(times);
  const point=(angle:number,radius:number)=>({
    x:180+radius*Math.sin(angle*Math.PI/180),
    y:180-radius*Math.cos(angle*Math.PI/180),
  });
  const rects=sectors.flatMap((sector,index)=>{
    const layout=prayerSectorVisualLayout(sector.from,sector.to);
    return [
      {type:'clock',index,...point(layout.clockAngle,layout.clockRadius),
        width:layout.clockWidth,height:layout.clockHeight},
      {type:'label',index,...point(layout.labelAngle,layout.labelRadius),
        width:layout.labelWidth,height:layout.labelHeight},
    ];
  });
  for(const label of rects.filter(r=>r.type==='label')){
    for(const other of rects){
      if(label===other)continue;
      assert.ok(Math.abs(label.x-other.x)>=(label.width+other.width)/2-0.1 ||
        Math.abs(label.y-other.y)>=(label.height+other.height)/2-0.1,
        times[label.index].label+' label overlaps '+times[other.index].label+' '+other.type);
    }
  }
  for(const key of ['imsak','aksam'] as const){
    const i=times.findIndex(item=>item.key===key);
    const sector=sectors[i];
    const layout=prayerSectorVisualLayout(sector.from,sector.to);
    assert.ok(layout.labelWidth<=48,'narrow names need a compact radial lane');
    assert.ok(layout.labelHeight<=27,'do not clip narrow-sector text with oversized cards');
  }
});

test('clock + prayer name stay on the separator while the icon is centered',()=>{
  for(const sector of makeVisualDialSectors(schedule.times)){
    const layout=prayerSectorVisualLayout(sector.from,sector.to);
    assert.equal(layout.clockAngle,sector.from);
    assert.equal(layout.labelAngle,(sector.from+sector.to)/2);
    assert.ok(layout.clockHeight>=28,'clock and caption require two lines');
    assert.ok(layout.labelWidth<=24,'inner icon should not cover the clock');
    assert.ok(layout.clockRadius+layout.clockHeight/2<169);
    assert.ok(layout.labelRadius-layout.labelHeight/2>106);
  }
});
