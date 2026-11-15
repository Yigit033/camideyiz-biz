// Release acceptance gate for original, pixel-identical WebP teaching posters.
// Validates a manifest generated only after exact-source PNG verification.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const dir=resolve(dirname(fileURLToPath(import.meta.url)),'../apps/mobile/assets/kerahat');
const expected={
 heavy:{name:'agir-kerahat.webp',source:'dd7a26f775110bc3a911be35c78ec9c90e3d3e0a2e0a470343cfaedb410babf7'},
 light:{name:'hafif-kerahat.webp',source:'f403909395ea5e9f676680f9c6df53e7a1b0cd9f9730328b8bafa3a3b1a3cce5'},
};
const hash=buf=>createHash('sha256').update(buf).digest('hex');
let ok=true;
let manifest;
try{manifest=JSON.parse(readFileSync(join(dir,'poster-integrity.json'),'utf8'));}
catch{console.error('FAIL: poster-integrity.json is missing. Install verified original posters.');process.exit(1);}
if(manifest.version!==1||manifest.encoding!=='webp-lossless'||manifest.width!==1126||manifest.height!==2000){
 console.error('FAIL: poster manifest schema is invalid.');process.exit(1);
}
for(const [key,item] of Object.entries(expected)){
 try{
  const entry=manifest.posters?.[key];
  if(!entry||entry.file!==item.name||entry.sourcePngSha256!==item.source)
   throw new Error('source identity not verified');
  const bytes=readFileSync(join(dir,item.name));
  if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')
   throw new Error('invalid WebP file');
  if(entry.webpSha256!==hash(bytes)||entry.webpBytes!==bytes.length)
   throw new Error('WebP file differs from verified conversion');
  const meta=await sharp(bytes).metadata();
  if(meta.format!=='webp'||meta.width!==1126||meta.height!==2000)
   throw new Error('wrong poster dimensions');
  const pixels=await sharp(bytes).ensureAlpha().raw().toBuffer();
  if(entry.pixelSha256!==hash(pixels))throw new Error('decoded pixel checksum mismatch');
  console.log('PASS '+key+': original-source lossless WebP, 1126x2000, pixels verified ('+bytes.length+' bytes).');
 }catch(error){ok=false;console.error('FAIL '+key+': '+error.message);}
}
if(!ok){console.error('Release blocked until both original kerahat posters are installed.');process.exitCode=1;}
