/**
 * Android status-bar / notification small icon: a white, alpha-only
 * silhouette of the brand mark (three figures + arches, no wordmark — text
 * is illegible at 24dp). Derived from splash-mark.png's alpha channel, which
 * is itself a pixel derivation of the owner-approved icon. Nothing redrawn.
 * expo-notifications resizes it to every density as @drawable/notification_icon.
 *
 *   node scripts/build-notification-icon.mjs          # writes the PNG
 *   node scripts/build-notification-icon.mjs --check  # committed PNG must match
 */
import sharp from 'sharp';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const assets=resolve(import.meta.dirname,'..','apps/mobile/assets');
const OUT=resolve(assets,'notification-icon.png');
const SIZE=96; // 24dp at xxxhdpi
const PAD=6;   // keeps the silhouette inside Android's 22dp live area

const {data,info}=await sharp(readFileSync(resolve(assets,'splash-mark.png'))).raw()
  .toBuffer({resolveWithObject:true});
const W=info.width,H=info.height;
// The symbol sits above the wordmark: find the widest transparent row band
// in the lower half — everything above it is the mark.
const rowInk=y=>{let s=0;for(let x=0;x<W;x++)if(data[(y*W+x)*4+3]>96)s++;return s;};
let bestStart=-1,bestLen=0,runStart=-1;
for(let y=Math.floor(H*0.5);y<H;y++){
  if(rowInk(y)===0){if(runStart<0)runStart=y;}
  else if(runStart>=0){
    if(y-runStart>bestLen){bestLen=y-runStart;bestStart=runStart;}
    runStart=-1;
  }
}
if(bestStart<0)throw new Error('Could not separate the mark from the wordmark');
// Crisp alpha silhouette (drops the soft glow halo), pure white ink.
const silhouette=Buffer.alloc(W*bestStart*4);
for(let i=0,j=0;j<silhouette.length;i+=4,j+=4){
  const a=data[i+3]/255;
  const t=Math.max(0,Math.min(1,(a-0.5)/0.35));
  silhouette[j]=silhouette[j+1]=silhouette[j+2]=255;
  silhouette[j+3]=Math.round(t*t*(3-2*t)*255);
}
const mark=await sharp(silhouette,{raw:{width:W,height:bestStart,channels:4}})
  .trim({threshold:1}).png().toBuffer();
const png=await sharp(mark)
  .resize({width:SIZE-2*PAD,height:SIZE-2*PAD,fit:'contain',
    background:{r:0,g:0,b:0,alpha:0},kernel:'lanczos3'})
  .extend({top:PAD,bottom:PAD,left:PAD,right:PAD,background:{r:0,g:0,b:0,alpha:0}})
  .png({compressionLevel:9}).toBuffer();

if(process.argv.includes('--check')){
  const a=existsSync(OUT)?await sharp(readFileSync(OUT)).raw().toBuffer():Buffer.alloc(0);
  if(!a.equals(await sharp(png).raw().toBuffer())){
    console.error('notification-icon.png is stale: run node scripts/build-notification-icon.mjs');
    process.exit(1);
  }
  console.log('Notification icon matches its splash-mark derivation');
}else{
  writeFileSync(OUT,png);
  console.log('notification-icon.png '+SIZE+'x'+SIZE+' (mark rows 0-'+bestStart+')');
}
