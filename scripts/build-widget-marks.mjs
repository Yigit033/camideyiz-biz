/**
 * Widget brand marks for both themes, derived from splash-mark.png (itself a
 * pixel derivation of the owner-approved icon, see build-splash-mark.mjs).
 * Pixel operations only — nothing is redrawn:
 *   dark : the transparent glowing cyan mark, as on the splash screen.
 *   light: same silhouette with crisp edges (no dark-field glow tail) and a
 *          luminance-preserving deep-azure tone map so the mark and the
 *          integrated camideyiz.biz wordmark read on the ivory light card.
 *
 *   node scripts/build-widget-marks.mjs          # writes both PNGs
 *   node scripts/build-widget-marks.mjs --check  # committed PNGs must match
 */
import sharp from 'sharp';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const assets=resolve(import.meta.dirname,'..','apps/mobile/assets');
const SOURCE=resolve(assets,'splash-mark.png');
export const OUTPUTS={dark:resolve(assets,'widget-mark-dark.png'),
  light:resolve(assets,'widget-mark-light.png')};
const WIDTH=384; // ≥ 4× the largest on-widget logo box (~96dp at xxxhdpi)
// Light tone map on the app's own brand blues (src/theme/tokens.ts):
// shadows → accentStrong #0C76B4, highlights → logo cyan #20B6EB. The
// wordmark lands near the shadow end, keeping ~4:1 contrast on ivory.
const LIGHT_SHADOW=[0x0C,0x76,0xB4],LIGHT_HIGHLIGHT=[0x20,0xB6,0xEB];
// The icon's glow is a ~20px soft ramp at the arch apex; on ivory it reads
// as a blurry band. A smoothstep edge keeps the silhouette and drops the halo.
const LIGHT_EDGE=[0.55,0.9];
const smoothstep=(lo,hi,v)=>{const t=Math.max(0,Math.min(1,(v-lo)/(hi-lo)));return t*t*(3-2*t);};
// Widget cards are lighter than the #050A1D splash field: faint field pixels
// would read as a darker box there, so keep only the real glow and mark.
const DARK_ALPHA_FLOOR=0.2;

const {data,info}=await sharp(readFileSync(SOURCE)).raw()
  .toBuffer({resolveWithObject:true});
const dark=Buffer.from(data);
for(let i=3;i<dark.length;i+=4){
  const a=Math.max(0,(dark[i]/255-DARK_ALPHA_FLOOR)/(1-DARK_ALPHA_FLOOR));
  dark[i]=Math.round(a*255);
}
const light=Buffer.alloc(data.length);
let minL=1,maxL=0;
const lum=i=>(0.299*data[i]+0.587*data[i+1]+0.114*data[i+2])/255;
for(let i=0;i<data.length;i+=4){
  if(data[i+3]<200)continue;
  const l=lum(i);minL=Math.min(minL,l);maxL=Math.max(maxL,l);
}
for(let i=0;i<data.length;i+=4){
  const a=smoothstep(LIGHT_EDGE[0],LIGHT_EDGE[1],data[i+3]/255);
  if(a<=0)continue;
  const t=Math.max(0,Math.min(1,(lum(i)-minL)/Math.max(1e-6,maxL-minL)));
  for(let c=0;c<3;c++)
    light[i+c]=Math.round(LIGHT_SHADOW[c]+(LIGHT_HIGHLIGHT[c]-LIGHT_SHADOW[c])*t);
  light[i+3]=Math.round(a*255);
}
const encode=raw=>sharp(raw,{raw:{width:info.width,height:info.height,channels:4}})
  .resize({width:WIDTH,kernel:'lanczos3'})
  .png({compressionLevel:9,adaptiveFiltering:true}).toBuffer();
const built={dark:await encode(dark),light:await encode(light)};

if(process.argv.includes('--check')){
  for(const [name,png] of Object.entries(built)){
    const file=OUTPUTS[name];
    const a=existsSync(file)?await sharp(readFileSync(file)).raw().toBuffer():Buffer.alloc(0);
    const b=await sharp(png).raw().toBuffer();
    if(!a.equals(b)){console.error('widget-mark-'+name+'.png is stale: run node scripts/build-widget-marks.mjs');process.exit(1);}
  }
  console.log('Widget marks match their splash-mark derivation (dark + light)');
}else{
  for(const [name,png] of Object.entries(built))writeFileSync(OUTPUTS[name],png);
  const meta=await sharp(built.light).metadata();
  console.log('widget marks written '+meta.width+'x'+meta.height);
}
