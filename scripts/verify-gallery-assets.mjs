// Verify bundled WebP gallery assets before release.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require('sharp');
const root=process.cwd();
const catalog=fs.readFileSync(path.join(root,'apps/mobile/src/features/gallery/galleryCatalog.ts'),'utf8');
const dir=path.join(root,'apps/mobile/assets/gallery');
const full=[...catalog.matchAll(/require\('\.\.\/\.\.\/\.\.\/assets\/gallery\/([^']+\.webp)'\)/g)]
  .map(x=>x[1]);
const photos=full.filter(name=>!name.endsWith('-thumb.webp'));
const thumbs=full.filter(name=>name.endsWith('-thumb.webp'));
if(photos.length!==27||thumbs.length!==27)throw Error('Expected 27 full and 27 thumbnail imports');
const seen=new Set();
for(const name of full){
 const p=path.join(dir,name);
 if(!fs.existsSync(p))throw Error('Missing gallery image: '+name);
 const data=fs.readFileSync(p);
 if(data.length<1000||data.length>2_000_000)throw Error('Unexpected asset size: '+name);
 const digest=crypto.createHash('sha256').update(data).digest('hex');
 if(seen.has(digest))throw Error('Duplicate optimized image: '+name);
 seen.add(digest);
 const meta=await sharp(data).metadata();
 if(meta.format!=='webp'||!meta.width||!meta.height)throw Error('Invalid WebP: '+name);
 if(!name.endsWith('-thumb.webp') && Math.min(meta.width,meta.height)<550)
   console.warn('Lower-resolution source; test exported quality:',name,meta.width,meta.height);
}
console.log(`Gallery QA OK: ${photos.length} photos + ${thumbs.length} thumbnails`);
