// Convert either of the user's 1126x2000 JPEG or verified PNG posters to
// lossless WebP. Compare decoded RGBA pixels to guarantee no recompression loss.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';

const root=dirname(fileURLToPath(import.meta.url));
const output=resolve(root,'../apps/mobile/assets/kerahat');
const sourceDir=process.argv[2]&&resolve(process.argv[2]);
if(!sourceDir)throw new Error('Pass a directory containing both original JPEG/PNG poster files.');
const EXPECTED=[
 {key:'heavy',name:'agir-kerahat',originalPngSha256:'dd7a26f775110bc3a911be35c78ec9c90e3d3e0a2e0a470343cfaedb410babf7'},
 {key:'light',name:'hafif-kerahat',originalPngSha256:'f403909395ea5e9f676680f9c6df53e7a1b0cd9f9730328b8bafa3a3b1a3cce5'},
];
const sha256=buf=>createHash('sha256').update(buf).digest('hex');
const prepared=[];
for(const item of EXPECTED){
  const candidates=['.png','.jpg','.jpeg'].map(ext=>join(sourceDir,item.name+ext)).filter(existsSync);
  if(candidates.length!==1)throw new Error(item.name+': exactly one PNG/JPEG source is required, found '+candidates.length);
  const filename=candidates[0];
  const ext=filename.split('.').at(-1).toLowerCase();
  const bytes=readFileSync(filename);
  const sourceSha256=sha256(bytes);
  if(ext==='png'&&sourceSha256!==item.originalPngSha256)
    throw new Error(item.name+': original PNG SHA-256 mismatch. Refusing modified source.');
  const meta=await sharp(bytes,{failOn:'error'}).metadata();
  const expectedFormat=ext==='png'?'png':'jpeg';
  if(meta.format!==expectedFormat||meta.width!==1126||meta.height!==2000)
    throw new Error(item.name+': source must be a genuine 1126x2000 '+expectedFormat+' image.');
  // Source JPEG may already contain compression artifacts. This operation
  // preserves exactly its CURRENT decoded pixels; it cannot restore prior detail.
  const originalRGBA=await sharp(bytes,{failOn:'error'}).ensureAlpha().raw().toBuffer();
  const webp=await sharp(bytes,{failOn:'error'})
    .webp({lossless:true,nearLossless:false,effort:6}).toBuffer();
  const outputRGBA=await sharp(webp,{failOn:'error'}).ensureAlpha().raw().toBuffer();
  if(!originalRGBA.equals(outputRGBA))
    throw new Error(item.name+': pixel mismatch. Refusing modified poster.');
  const outMeta=await sharp(webp).metadata();
  if(outMeta.format!=='webp'||outMeta.width!==1126||outMeta.height!==2000)
    throw new Error(item.name+': output WebP format/dimensions invalid.');
  prepared.push({
    item,webp,sourceSha256,sourceFormat:meta.format,
    sourceBytes:bytes.length,webpBytes:webp.length,pixelSha256:sha256(outputRGBA),
    sourceFilename:item.name+'.'+ext,
  });
}
// Both inputs are validated BEFORE writing any WebP files.
mkdirSync(output,{recursive:true});
const manifest={version:2,encoding:'webp-lossless',width:1126,height:2000,posters:{}};
for(const v of prepared){
  writeFileSync(join(output,v.item.name+'.webp'),v.webp);
  manifest.posters[v.item.key]={
    file:v.item.name+'.webp',sourceFilename:v.sourceFilename,
    sourceFormat:v.sourceFormat,sourceSha256:v.sourceSha256,
    sourceBytes:v.sourceBytes,webpSha256:sha256(v.webp),
    webpBytes:v.webpBytes,pixelSha256:v.pixelSha256,
  };
  const percent=(100*(1-v.webpBytes/v.sourceBytes)).toFixed(1);
  console.log(v.item.name+': '+v.sourceFormat.toUpperCase()+' '+v.sourceBytes+
    ' bytes -> lossless WebP '+v.webpBytes+' bytes ('+percent+'% saved; negative means larger).');
}
writeFileSync(join(output,'poster-integrity.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('PASS: both images converted with identical decoded RGBA pixels.');
