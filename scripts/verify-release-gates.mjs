/**
 * Runs every offline release gate of build-android-windows.ps1, in the same
 * order, BEFORE a commit or a Windows build. The list is read from the build
 * script itself, so a gate added there can never be missed here.
 *
 *   npm run verify:release
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const build=readFileSync(resolve(root,'scripts/build-android-windows.ps1'),'utf8');
const gates=[...build.matchAll(/^\s*& node ((?:--[\w-]+ )*)(scripts\/[\w.-]+\.mjs)((?: --[\w-]+)*)\s*$/gm)]
  .map(([,flags,script,args])=>[...flags.split(' '),script,...args.split(' ')].filter(Boolean));
assert.ok(gates.length>=15,'could not read the release gates from build-android-windows.ps1');

const failed=[];
for(const args of gates){
  const label=args.filter(a=>!a.startsWith('--experimental')).join(' ');
  process.stdout.write('==> '+label+'\n');
  const run=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});
  if(run.status!==0)failed.push(label);
}
if(failed.length){
  console.error('\nRelease gates failed ('+failed.length+'/'+gates.length+'):\n  '+failed.join('\n  '));
  process.exit(1);
}
console.log('\nAll '+gates.length+' release gates of build-android-windows.ps1 passed');
