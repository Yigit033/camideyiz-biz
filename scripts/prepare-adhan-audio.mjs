/**
 * Vendor a redistributable CC0 ezan MP3 into the mobile app bundle.
 *
 * Source recording: "Beautiful adhan.ogg" by Adam-synagda (2022).
 * https://commons.wikimedia.org/wiki/File:Beautiful_adhan.ogg
 * License: CC0 1.0 (public-domain dedication).
 * Converted MP3 served by Wikimedia Commons, ~2m34s.
 *
 * This script runs at *build time*, never in the mobile app. It is also safe
 * to run again when a verified copy is present, including without internet.
 * Do NOT replace with arbitrary "free download" ezan recordings; listen and
 * recheck the recording's source and licence before shipping.
 */
import {mkdir,readFile,rename,rm,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(root,'apps/mobile/assets/audio/beautiful-adhan.mp3');
const source='https://upload.wikimedia.org/wikipedia/commons/transcoded/b/b0/Beautiful_adhan.ogg/Beautiful_adhan.ogg.mp3';
const MIN_BYTES=200_000;
const MAX_BYTES=6_000_000;

function validMP3(bytes){
  if(bytes.length<MIN_BYTES||bytes.length>MAX_BYTES)return false;
  // Accept standard ID3 tags or a MPEG Layer-III sync header.
  return bytes.toString('ascii',0,3)==='ID3'||
    (bytes[0]===0xff && (bytes[1]&0xe0)===0xe0);
}
try{
  if(validMP3(await readFile(output))){
    console.log('Offline ezan MP3 present: '+output);
    process.exit(0);
  }
}catch(error){
  if(error?.code!=='ENOENT')throw error;
}
await mkdir(dirname(output),{recursive:true});
let failure;
for(let attempt=1;attempt<=3;attempt++){
  const temp=output+'.tmp';
  try{
    const response=await fetch(source,{
      headers:{'User-Agent':'CamideyizBiz/0.1 (https://github.com/Yigit033/camideyiz-biz; offline asset build)'},
      signal:AbortSignal.timeout(30_000),
    });
    if(!response.ok)throw Error('Wikimedia Commons HTTP '+response.status);
    const type=response.headers.get('content-type')||'';
    if(type.includes('text/html'))throw Error('Unexpected HTML response for MP3');
    const length=Number(response.headers.get('content-length')||0);
    if(length>MAX_BYTES)throw Error('MP3 exceeds asset size limit');
    const bytes=Buffer.from(await response.arrayBuffer());
    if(!validMP3(bytes))throw Error('Invalid or incomplete MP3 payload');
    await writeFile(temp,bytes);
    await rename(temp,output);
    console.log('Downloaded CC0 ezan MP3 for offline bundle ('+bytes.length+' bytes)');
    process.exit(0);
  }catch(error){
    failure=error;
    await rm(temp,{force:true}).catch(()=>undefined);
    if(attempt<3)await new Promise(resolve=>setTimeout(resolve,attempt*1000));
  }
}
console.error('Could not prepare the offline ezan MP3: '+String(failure));
console.error('Retry: npm run prepare:adhan. Do not ship an APK without this file.');
process.exitCode=1;
