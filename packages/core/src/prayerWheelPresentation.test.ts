import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_SCHEDULE} from './prayer.ts';
import {indicativeKerahatWindows} from './timeline.ts';
import {
  prayerSectorLabelAngle,prayerSectorVisualLayout,currentPrayerArc,
  kerahatRingWindows,KERAHAT_APPROACH_SECONDS,
  prayerBadgeForeground,PRAYER_BADGE_DARK_INK,PRAYER_BADGE_LIGHT_INK,
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
test('P1 kerahet ring has a 20m amber approach and burgundy active band at exact bounds',()=>{
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
  assert.equal(kerahatRingWindows(windows,sec(12,10))[1].state,'approaching');
  assert.equal(kerahatRingWindows(windows,sec(12,22))[1].state,'active');
  assert.equal(kerahatRingWindows(windows,sec(12,44))[1].state,'active');
  assert.equal(kerahatRingWindows(windows,sec(17,10))[2].state,'active');
  assert.ok(kerahatRingWindows(windows,sec(21,0)).every(w=>w.state==='inactive'));
  assert.equal(kerahatRingWindows([],sec(17,10)).length,0,
    'hidden or unavailable kerahet produces NO warning without source data');
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

test('kerahet windows retain exact 24-hour proportional dial angles',()=>{
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
    assert.ok(layout.clockHeight>=26,'two-line capsule must have enough height for compact labels');
    assert.ok(layout.labelWidth<=24,'inner icon should not cover the clock');
    assert.ok(layout.clockRadius+layout.clockHeight/2<169);
    assert.ok(layout.labelRadius-layout.labelHeight/2>106);
  }
});

test('prayer clocks and icons occupy the exact radial midpoint of coloured band',()=>{
  const middle=(106.5+171.5)/2;
  const sectors=makeVisualDialSectors(schedule.times);
  for(const sector of sectors){
    const layout=prayerSectorVisualLayout(sector.from,sector.to);
    assert.equal(layout.clockRadius,middle,'clock/name capsule at band middle');
    assert.equal(layout.labelRadius,middle,'icon at band middle');
    assert.equal(layout.clockAngle,sector.from,'time/name belongs to divider');
    assert.equal(layout.labelAngle,(sector.from+sector.to)/2,'icon belongs to wedge centre');
    assert.ok(layout.clockWidth<=35,'time badge must be smaller than previous 52px');
    assert.ok(layout.clockHeight<=27,'time and name fit compact two-line capsule');
  }
});

test('inner red ring responds exactly to the user-selected noon duration',()=>{
  const sectors=makeVisualDialSectors(schedule.times);
  const defaults=indicativeKerahatWindows(schedule);
  const customized=indicativeKerahatWindows(schedule,{preNoonMinutes:10});
  const a=defaults[1],b=customized[1];
  assert.equal((a.endSeconds-a.startSeconds)/60,30);
  assert.equal((b.endSeconds-b.startSeconds)/60,10);
  const aFrom=clockSecondsToVisualAngle(a.startSeconds,schedule.times,sectors);
  const aTo=clockSecondsToVisualAngle(a.endSeconds,schedule.times,sectors);
  const bFrom=clockSecondsToVisualAngle(b.startSeconds,schedule.times,sectors);
  const bTo=clockSecondsToVisualAngle(b.endSeconds,schedule.times,sectors);
  assert.equal(aTo,bTo,'same exact noon endpoint on the dial');
  assert.ok(Math.abs((aTo-aFrom)-7.5)<1e-9,'30-minute overlay spans 7.5°');
  assert.ok(Math.abs((bTo-bFrom)-2.5)<1e-9,'10-minute overlay spans 2.5°');
  assert.equal(kerahatRingWindows(defaults,sec(12,30))[1].state,'active');
  assert.equal(kerahatRingWindows(customized,sec(12,30))[1].state,'approaching');
  assert.equal(kerahatRingWindows(customized,sec(12,20))[1].state,'inactive');
  assert.equal(kerahatRingWindows(defaults,sec(12,52))[1].state,'inactive');
});

test('all six exact prayer-colour clock badges meet WCAG small-caption contrast',()=>{
  const sectorColours={
    imsak:'#3593B5',gunes:'#D69E44',ogle:'#1EAFB0',
    ikindi:'#10B981',aksam:'#DA7049',yatsi:'#7162BB',
  } as const;
  function luminance(hex:string){
    const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255)
      .map(x=>x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4));
    return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
  }
  for(const [name,bg] of Object.entries(sectorColours)){
    const ink=prayerBadgeForeground(bg);
    const l1=luminance(bg),l2=luminance(ink);
    const ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
    assert.ok(ratio>=4.5,name+' has insufficient clock/name contrast: '+ratio);
  }
  assert.equal(prayerBadgeForeground(sectorColours.imsak),PRAYER_BADGE_DARK_INK);
  assert.equal(prayerBadgeForeground(sectorColours.yatsi),PRAYER_BADGE_LIGHT_INK);
  assert.throws(()=>prayerBadgeForeground('orange'),RangeError);
});
