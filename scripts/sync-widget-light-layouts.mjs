/**
 * Single source of truth for widget themes: every *_light.xml layout is
 * DERIVED from its dark layout through one design-token table. Structure,
 * sizes and IDs can therefore never drift between themes (the ring widgets
 * once shipped "light" layouts that were dark copies).
 *
 *   node scripts/sync-widget-light-layouts.mjs          # regenerate
 *   node scripts/sync-widget-light-layouts.mjs --check  # CI: fail on drift
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const dir=resolve(import.meta.dirname,'..','apps/mobile/plugins/widget-native');
export const FAMILIES=['widget_next_prayer','widget_prayer_day','widget_compact_prayer',
  'widget_prayer_focus','widget_prayer_strip','widget_ring_mini','widget_ring_premium',
  'widget_slim_prayer','widget_ring_square','widget_prayer_row','widget_prayer_column'];
// Dark ink → light ink. Any other colour in a dark layout is an error, so a
// new colour must be given a deliberate light counterpart here.
export const INKS={
  '#F1F7F8':'#163045', // primary text
  '#AFC5D4':'#607481', // muted labels
  '#ADC7D5':'#465E70', // secondary clocks
  '#F4D392':'#91652D', // gold countdown / accents
  '#31566D':'#DAE3E6', // hairline rules
  '#D6F1FC':'#3F5A4E', // soft caption ("Kalan")
  '#3CC8F5':'#0C76B4', // logo-cyan countdown → deep azure of the light mark
  '#8FDCF8':'#0C76B4', // Hijri / Gregorian dates
  '#F0C97F':'#A88A5C', // prayer icon gold
};
const DRAWABLES=[
  [/@drawable\/widget_bg"/g,'@drawable/widget_bg_light"'],
  [/@drawable\/widget_chip_dark"/g,'@drawable/widget_chip_light"'],
  [/@drawable\/widget_box_dark"/g,'@drawable/widget_box_light"'],
  [/@drawable\/widget_cell_dark"/g,'@drawable/widget_cell_light"'],
  [/@drawable\/widget_rule_dark"/g,'@drawable/widget_rule_light"'],
  // Glowing cyan mark on navy → deep-azure mark on ivory (build-widget-marks.mjs).
  [/@drawable\/widget_brand_mark_dark"/g,'@drawable/widget_brand_mark_light"'],
];
export function toLight(xml,name='layout'){
  let out=xml.replace(/#[0-9A-Fa-f]{6}\b/g,hex=>{
    const light=INKS[hex.toUpperCase()];
    if(!light)throw new Error(name+': colour '+hex+' has no light design token');
    return light;
  });
  for(const [from,to] of DRAWABLES)out=out.replace(from,to);
  return out.replace(/<!-- (.*?) -->/,'<!-- GENERATED from '+name+
    '.xml by scripts/sync-widget-light-layouts.mjs. Do not edit. $1 -->');
}

const check=process.argv.includes('--check');
const stale=[];
for(const name of FAMILIES){
  const dark=readFileSync(resolve(dir,name+'.xml'),'utf8');
  const light=toLight(dark,name);
  const file=resolve(dir,name+'_light.xml');
  let current='';
  try{current=readFileSync(file,'utf8');}catch{/* first generation */}
  if(current===light)continue;
  if(check)stale.push(name+'_light.xml');
  else writeFileSync(file,light,'utf8');
}
if(stale.length){
  console.error('Light widget layouts are out of date: '+stale.join(', ')+
    '\nRun: node scripts/sync-widget-light-layouts.mjs');
  process.exit(1);
}
console.log(check?'Widget light layouts match their dark sources ('+FAMILIES.length+' families)'
  :'Widget light layouts regenerated from dark sources');
