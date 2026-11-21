/**
 * Brand rule: the DARK theme is the logo's midnight blue + cyan + gold.
 * No green/teal colour may appear in a dark-only branch
 * (dark?'A':'B' / isDark?'A':'B'). The light theme keeps its original
 * emerald/ivory palette, and categorical colours (e.g. the İkindi sector)
 * are shared by design, so only dark-specific branches are checked.
 */
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const walk=dir=>readdirSync(dir).flatMap(name=>{
  const path=join(dir,name);
  return statSync(path).isDirectory()?walk(path):/\.tsx?$/.test(name)?[path]:[];
});
const toRgb=c=>{
  let m=c.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if(m)return [0,2,4].map(i=>parseInt(m[1].slice(i,i+2),16));
  m=c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  return m?[+m[1],+m[2],+m[3]]:null;
};
const isGreen=c=>{
  const rgb=toRgb(c);if(!rgb)return false;
  const [r,g,b]=rgb.map(v=>v/255);const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
  if(!d)return false;
  let h=max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;h*=60;if(h<0)h+=360;
  const l=(max+min)/2,s=d/(1-Math.abs(2*l-1));
  return h>=85&&h<=175&&s>=.12&&l>.04&&l<.96;
};
const COLOR=String.raw`(#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?|rgba?\([^)]*\))`;
const dark=new RegExp(String.raw`(?:dark|isDark|colors\.isDark)\s*\?\s*['"]`+COLOR+`['"]`,'g');
const offenders=[];
for(const file of walk(resolve(root,'apps/mobile/src'))){
  const src=readFileSync(file,'utf8');
  for(const m of src.matchAll(dark)){
    if(isGreen(m[1]))offenders.push(relative(root,file)+':'+
      src.slice(0,m.index).split('\n').length+' '+m[1]);
  }
}
assert.deepEqual(offenders,[],'Dark theme must use the brand blue palette, not green:\n'+offenders.join('\n'));
// The in-app widget preview mirrors the real midnight-blue widgets.
const preview=readFileSync(resolve(root,'apps/mobile/src/features/widgets/WidgetPreview.tsx'),'utf8');
assert.match(preview,/dark:\{card:'#0C2438'/);
for(const f of ['NextPrayerWidget.ios.tsx','PrayerDayWidget.ios.tsx'])
  assert.match(readFileSync(resolve(root,'apps/mobile/src/features/widgets',f),'utf8'),
    /containerBackground\('#0C2438'/,f+' must use the midnight-blue widget background');
console.log('Dark palette: no green in dark-only branches; widget preview and iOS widgets on brand midnight blue');
