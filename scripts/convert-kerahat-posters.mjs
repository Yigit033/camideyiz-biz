// Converts VERIFIED original PNG teaching posters into pixel-identical WebP.
// Usage: node scripts/convert-kerahat-posters.mjs <directory-containing-two-original-pngs>
// The script refuses unverified sources, changed pixels, or wrong dimensions.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';

const base=dirname(fileURLToPath(import.meta.url));
const output=resolve(base,'../apps/mobile/assets/kerahat');
const input=process.argv[2];
if(!input)throw new Error('Provide the directory containing both original PNG files.');
const EXPECTED=[
 {key:'heavy',name:'agir-kerahat',pngHash:'dd7a26f775110bc3a911be35c78ec9c90e3d3e0a2e0a470343cfaedb410babf7'},
 {key:'light',name:'hafif-kerahat',pngHash:'f403909395ea5e9f676680f9c6df53e7a1b0cd9f9730328b8bafa3a3b1a3cce5'},
];
const hash=buf=>createHash('sha256').update(buf).digest('hex');
const prepared=[];
for(const item of EXPECTED){
  const png=readFileSync(join(resolve(input),item.name+'.png'));
  if(hash(png)!==item.pngHash)throw new Error(item.name+': original PNG SHA-256 mismatch.');
  const source=sharp(png,{failOn:'error'});
  const meta=await source.metadata();
  if(meta.format!=='png'||meta.width!==1126||meta.height!==2000)
    throw new Error(item.name+': expected original 1126x2000 PNG.');
  // Decode through the same RGBA pipeline; exact buffer equality proves
  // that converting did not modify any pixel or text glyph.
  const rgba=await sharp(png).ensureAlpha().raw().toBuffer();
  const webp=await sharp(png).webp({lossless:true,nearLossless:false,effort:6}).toBuffer();
  const decoded=await sharp(webp).ensureAlpha().raw().toBuffer();
  if(!rgba.equals(decoded))throw new Error(item.name+': WebP pixel mismatch; refusing conversion.');
  const wmeta=await sharp(webp).metadata();
  if(wmeta.format!=='webp'||wmeta.width!==1126||wmeta.height!==2000)
    throw new Error(item.name+': converted WebP dimensions/format incorrect.');
  prepared.push({item,webp,pngBytes:png.length,webpBytes:webp.length,pixelSha256:hash(decoded)});
}
mkdirSync(output,{recursive:true});
const manifest={version:1,encoding:'webp-lossless',width:1126,height:2000,posters:{}};
for(const value of prepared){
  const {item,webp,pngBytes,webpBytes,pixelSha256}=value;
  writeFileSync(join(output,item.name+'.webp'),webp);
  manifest.posters[item.key]={
    file:item.name+'.webp',sourcePngSha256:item.pngHash,
    webpSha256:hash(webp),pixelSha256,sourceBytes:pngBytes,webpBytes,
  };
  const delta=(100*(1-webpBytes/pngBytes)).toFixed(1);
  console.log(item.name+': PNG '+pngBytes+' bytes -> lossless WebP '+webpBytes+' bytes ('+delta+'% saved).');
}
writeFileSync(join(output,'poster-integrity.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Both poster pixels verified. Commit WebP files and poster-integrity.json together.');
