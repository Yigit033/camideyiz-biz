// Smoke-test the actual Expo/Metro startup in CI, not just TypeScript and packages.
// Prevents regressions such as a missing expo-router/internal/testing dependency.
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';

const cwd=new URL('../apps/mobile/', import.meta.url).pathname;
const port=18891;
const child=spawn('npx',['expo','start','--offline','--port',String(port)],{
  cwd,
  env:{...process.env,CI:'1',EXPO_OFFLINE:'1',EXPO_NO_TELEMETRY:'1'},
  stdio:['ignore','pipe','pipe'],
  detached:process.platform!=='win32'
});
let logs='';
let exitCode=null;
child.stdout.on('data',chunk=>{logs+=String(chunk);process.stdout.write(chunk);});
child.stderr.on('data',chunk=>{logs+=String(chunk);process.stderr.write(chunk);});
child.on('exit',(code,signal)=>{exitCode=code??1;});
child.on('error',err=>{logs+=String(err);exitCode=1;});

function cleanup(){
  if(!child.pid)return;
  try{
    if(process.platform!=='win32')process.kill(-child.pid,'SIGTERM');
    else child.kill('SIGTERM');
  }catch{}
}

try {
  const start=Date.now();
  let healthySince=null;
  while(Date.now()-start<65000){
    if(exitCode!==null)throw new Error('Expo exited unexpectedly: '+exitCode);
    if(/Cannot find module|MODULE_NOT_FOUND|Error: Cannot/i.test(logs))throw new Error('Expo startup dependency resolution failed');
    try {
      const response=await fetch('http://127.0.0.1:'+port+'/status',{signal:AbortSignal.timeout(1600)});
      const body=await response.text();
      if(response.ok && body.includes('packager-status:running')){
        healthySince??=Date.now();
        // Keep the process alive long enough to catch late asynchronous failures.
        if(Date.now()-healthySince>=6000){
          process.stdout.write('\nExpo Metro startup smoke check passed.\n');
          process.exitCode=0;break;
        }
      }
    }catch{ /* Metro not ready yet */ }
    await sleep(750);
  }
  if(healthySince===null || Date.now()-healthySince<6000)throw new Error('Metro did not become and remain healthy within 65s');
}catch(error){
  process.stderr.write('\nExpo Metro smoke FAILED: '+String(error)+'\n');
  process.exitCode=1;
}finally{
  cleanup();
}
