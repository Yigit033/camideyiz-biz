/**
 * Prepare the EXACT owner-supplied Ezan recording for the offline app.
 *
 * The user supplied Camideyiz_Biz_Ezan.mp3 in this project chat (197.3 sec,
 * MPEG Layer III, 44.1 kHz / 128 kbps). Its SHA-256 below is authoritative.
 * This build must NEVER silently fall back to the old CC0 demo ezan.
 *
 * Place the file in apps/mobile/assets/audio/camideyiz-biz-ezan.mp3
 * (gitignored) to build completely offline. Alternatively, CI attempts
 * the user's nominated public source URL and REQUIRES the exact same hash.
 *
 * A .gitignore prevents source control inclusion; it does not grant audio
 * redistribution rights in a published APK.
 */
import {createHash} from 'node:crypto';
import {mkdir,readFile,rename,rm,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(root,'apps/mobile/assets/audio/camideyiz-biz-ezan.mp3');
const source=process.env.CAMIDEYIZ_EZAN_SOURCE_URL?.trim()||
  'https://konyacami.com/ses_dosya/Ogle_ezani.mp3';
const expectedSHA='09b6077c9ec6acaa3de1721de4a1f558c9e7ec0044c916d29ba6ea19b53ea77f';
const expectedBytes=3156985;

function verify(buffer){
  if(buffer.length!==expectedBytes)throw Error(
    'Beklenmeyen ezan boyutu: '+buffer.length+' (beklenen '+expectedBytes+')');
  if(buffer.toString('ascii',0,3)!=='ID3'&&
    !(buffer[0]===0xff && (buffer[1]&0xe0)===0xe0))
    throw Error('Ezan dosyası MP3 değil.');
  const sha=createHash('sha256').update(buffer).digest('hex');
  if(sha!==expectedSHA)throw Error(
    'Ezanın SHA-256 değeri yüklediğiniz dosyayla eşleşmedi. Başka ses kullanılamaz.');
}
try{
  const present=await readFile(output);
  verify(present);
  console.log('Kullanıcının seçtiği ezan doğrulandı: '+output);
  process.exit(0);
}catch(error){
  if(error?.code!=='ENOENT')throw error;
}
await mkdir(dirname(output),{recursive:true});
let lastError;
for(let i=0;i<2;i++){
  const temp=output+'.tmp';
  try{
    const response=await fetch(source,{
      headers:{'User-Agent':'CamideyizBiz/0.1 (https://github.com/Yigit033/camideyiz-biz; user-chosen ezan verification)'},
      signal:AbortSignal.timeout(25_000),
    });
    if(!response.ok)throw Error('HTTP '+response.status);
    const bytes=Buffer.from(await response.arrayBuffer());
    verify(bytes);
    await writeFile(temp,bytes);
    await rename(temp,output);
    console.log('Yüklenen sesle eşleşen MP3 çevrimdışı uygulama paketine hazır.');
    process.exit(0);
  }catch(error){
    lastError=error;
    await rm(temp,{force:true}).catch(()=>{});
  }
}
console.error('Seçtiğiniz MP3 hazır değil: '+String(lastError));
console.error('Camideyiz_Biz_Ezan.mp3 dosyasını apps/mobile/assets/audio/camideyiz-biz-ezan.mp3 konumuna kopyalayın.');
console.error('Doğrulanan SHA-256: '+expectedSHA);
process.exitCode=1;
