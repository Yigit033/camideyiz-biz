// Cross-platform release acceptance check for the user's *unaltered* posters.
// Intentionally rejects the temporary 1×1 PNG placeholders.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const posters=[
  {
    label:'Ağır Kerahat',
    path:'../apps/mobile/assets/kerahat/agir-kerahat.png',
    sha256:'dd7a26f775110bc3a911be35c78ec9c90e3d3e0a2e0a470343cfaedb410babf7',
  },
  {
    label:'Hafif Kerahat',
    path:'../apps/mobile/assets/kerahat/hafif-kerahat.png',
    sha256:'f403909395ea5e9f676680f9c6df53e7a1b0cd9f9730328b8bafa3a3b1a3cce5',
  },
];

const pngSignature=Buffer.from([137,80,78,71,13,10,26,10]);
let valid=true;
for(const poster of posters){
  try {
    const data=readFileSync(new URL(poster.path,import.meta.url));
    const isPng=data.length>=24 &&
      data.subarray(0,8).equals(pngSignature) &&
      data.toString('ascii',12,16)==='IHDR';
    const width=isPng?data.readUInt32BE(16):0;
    const height=isPng?data.readUInt32BE(20):0;
    const hash=createHash('sha256').update(data).digest('hex');
    if(!isPng || width!==1126 || height!==2000 || hash!==poster.sha256){
      valid=false;
      console.error('FAIL '+poster.label+': expected untouched 1126x2000 original PNG with exact SHA-256.');
      console.error('     Found: '+width+'x'+height+', SHA-256 '+hash);
    }else{
      console.log('PASS '+poster.label+': original PNG, 1126x2000, SHA-256 verified.');
    }
  }catch(error){
    valid=false;
    console.error('FAIL '+poster.label+': '+error.message);
  }
}
if(!valid){
  console.error('Original kerahat posters are missing or modified. Do not ship an APK.');
  console.error('Install the original ZIP using scripts/install-kerahat-posters.ps1 before release.');
  process.exitCode=1;
}
