// Verify that the bundled WebP matches the conversion manifest and its
// decoded pixels. For PNG we also know the external reference hash; for JPEG
// source identity comes solely from the user's supplied ZIP (not externally proven).
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';

const dir=resolve(dirname(fileURLToPath(import.meta.url)),'../apps/mobile/assets/kerahat');
const expected={
 heavy:{file:'agir-kerahat.webp',base:'agir-kerahat',originalPngSha256:'dd7a26f775110bc3a911be35c78ec9c90e3d3e0a2e0a470343cfaedb410babf7'},
 light:{file:'hafif-kerahat.webp',base:'hafif-kerahat',originalPngSha256:'f403909395ea5e9f676680f9c6df53e7a1b0cd9f9730328b8bafa3a3b1a3cce5'},
};
const sha256=buf=>createHash('sha256').update(buf).digest('hex');
let manifest;
try{manifest=JSON.parse(readFileSync(join(dir,'poster-integrity.json'),'utf8'));}
catch{console.error('FAIL: missing poster-integrity.json; install actual user-supplied images.');process.exit(1);}
if(manifest.version!==2||manifest.encoding!=='webp-lossless'||manifest.width!==1126||manifest.height!==2000)
  throw new Error('Invalid poster manifest schema.');
let valid=true;
for(const [key,item] of Object.entries(expected)){
  try{
    const m=manifest.posters?.[key];
    if(!m||m.file!==item.file||!['jpeg','png'].includes(m.sourceFormat)||
       !new RegExp('^'+item.base+'\\.(png|jpe?g)$','i').test(m.sourceFilename)||
       typeof m.sourceSha256!=='string'||!/^[a-f0-9]{64}$/.test(m.sourceSha256)||
       typeof m.sourceBytes!=='number'||m.sourceBytes<100||
       typeof m.webpBytes!=='number'||m.webpBytes<100)
      throw new Error('missing or invalid source metadata');
    if(m.sourceFormat==='png'&&m.sourceSha256!==item.originalPngSha256)
      throw new Error('original PNG SHA-256 mismatch');
    if(m.sourceFormat==='png'&&!m.sourceFilename.toLowerCase().endsWith('.png')||
       m.sourceFormat==='jpeg'&&m.sourceFilename.toLowerCase().endsWith('.png'))
      throw new Error('source extension and format disagree');
    const webp=readFileSync(join(dir,item.file));
    if(webp.toString('ascii',0,4)!=='RIFF'||webp.toString('ascii',8,12)!=='WEBP')
      throw new Error('not a WebP file');
    if(sha256(webp)!==m.webpSha256||webp.length!==m.webpBytes)
      throw new Error('file checksum/size mismatch');
    const meta=await sharp(webp,{failOn:'error'}).metadata();
    if(meta.format!=='webp'||meta.width!==1126||meta.height!==2000)
      throw new Error('incorrect output dimensions');
    const decoded=await sharp(webp,{failOn:'error'}).ensureAlpha().raw().toBuffer();
    if(sha256(decoded)!==m.pixelSha256)throw new Error('pixel checksum mismatch');
    console.log('PASS '+item.base+' ('+m.sourceFormat+'): 1126x2000, file and pixel hashes verified.');
  }catch(error){valid=false;console.error('FAIL '+item.base+': '+error.message);}
}
if(!valid){console.error('Do not build a Release APK with incomplete/modified posters.');process.exitCode=1;}
