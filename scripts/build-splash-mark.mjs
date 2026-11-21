/**
 * Derives the splash-screen brand mark from the OWNER-APPROVED launcher icon
 * (docs/APP_ICON_OWNER_APPROVED_2026_11_19.md). Pixel operations only: crop
 * of the mark + wordmark and un-compositing of the emitted blue light from
 * the midnight-navy field. Nothing is redrawn or generated.
 *
 * Splash background SPLASH_BG composited under this PNG reproduces the icon's
 * mark; the alpha threshold drops the icon's faint field gradient so no box
 * edge is visible on the flat splash colour.
 *
 *   node scripts/build-splash-mark.mjs          # writes apps/mobile/assets/splash-mark.png
 *   node scripts/build-splash-mark.mjs --check  # CI/local: committed PNG must match
 */
import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const ICON=resolve(root,'apps/mobile/assets/app-icon.png');
const OUT=resolve(root,'apps/mobile/assets/splash-mark.png');
export const ICON_SHA='54f731ab37e8a205dcba9c5b7c602d140a8fadbfc69851533482fe9935580f29';
export const SPLASH_BG=[0x05,0x0A,0x1D]; // #050A1D, the adaptive-icon background
// Mark + wordmark bounds inside the 1024px icon, clear of the border sheen.
const CROP={left:100,top:96,width:824,height:724};
const ALPHA_FLOOR=0.12;
// The icon's rounded-border highlight arc enters the crop's top-right corner.
// It never overlaps the mark (the right dot starts at y≈117), so clear it.
const BORDER_SHEEN={minX:690,maxY:84};

const sha=buffer=>createHash('sha256').update(buffer).digest('hex');
const check=process.argv.includes('--check');
if(!existsSync(ICON)){
  if(check){console.log('Splash mark: approved icon not installed locally; committed PNG kept');process.exit(0);}
  throw new Error('apps/mobile/assets/app-icon.png missing: extract camideyiz-icon-assets.zip first');
}
const icon=readFileSync(ICON);
if(sha(icon)!==ICON_SHA)throw new Error('app-icon.png is not the owner-approved artwork');

const {data,info}=await sharp(icon).extract(CROP).removeAlpha().raw()
  .toBuffer({resolveWithObject:true});
const out=Buffer.alloc(info.width*info.height*4);
for(let p=0,q=0;p<data.length;p+=3,q+=4){
  const x=(q/4)%info.width,y=Math.floor(q/4/info.width);
  if(x>=BORDER_SHEEN.minX&&y<=BORDER_SHEEN.maxY)continue;
  // Emitted light over the field: alpha is the strongest per-channel lift.
  let a=0;
  for(let c=0;c<3;c++){
    const lift=(data[p+c]-SPLASH_BG[c])/(255-SPLASH_BG[c]);
    if(lift>a)a=lift;
  }
  a=Math.max(0,(a-ALPHA_FLOOR)/(1-ALPHA_FLOOR));
  if(a<=0)continue; // transparent
  for(let c=0;c<3;c++){
    // Recover the colour that, composited over SPLASH_BG at alpha a, gives the pixel.
    const v=SPLASH_BG[c]+(data[p+c]-SPLASH_BG[c])/a;
    out[q+c]=Math.max(0,Math.min(255,Math.round(v)));
  }
  out[q+3]=Math.round(a*255);
}
const png=await sharp(out,{raw:{width:info.width,height:info.height,channels:4}})
  .png({compressionLevel:9,adaptiveFiltering:true}).toBuffer();
if(check){
  const committed=existsSync(OUT)?readFileSync(OUT):Buffer.alloc(0);
  // Compare decoded pixels: PNG encoders may differ across sharp builds.
  const a=committed.length?await sharp(committed).raw().toBuffer():Buffer.alloc(0);
  const b=await sharp(png).raw().toBuffer();
  if(!a.equals(b)){console.error('splash-mark.png is stale: run node scripts/build-splash-mark.mjs');process.exit(1);}
  console.log('Splash mark matches the owner-approved icon derivation');
}else{
  writeFileSync(OUT,png);
  console.log('splash-mark.png '+info.width+'x'+info.height+' sha256 '+sha(png));
}
