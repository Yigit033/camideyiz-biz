import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const read=p=>readFileSync(resolve(import.meta.dirname,'..',p),'utf8');
const app=JSON.parse(read('apps/mobile/app.json')).expo;
const root=read('apps/mobile/src/app/_layout.tsx');
const provider=read('apps/mobile/src/features/adhan/AdhanPlaybackProvider.tsx');
const card=read('apps/mobile/src/features/adhan/AdhanExperience.tsx');
const service=read('apps/mobile/plugins/adhan-native/AdhanPlaybackService.java');
const mobile=JSON.parse(read('apps/mobile/package.json'));
const plugin=app.plugins.find(p=>Array.isArray(p)&&p[0]==='expo-audio');
assert.ok(plugin,'expo-audio background config plugin missing');
assert.equal(plugin[1].enableBackgroundPlayback,true);
assert.equal(plugin[1].enableBackgroundRecording,false);
assert.equal(plugin[1].recordAudioAndroid,false);
assert.equal(mobile.dependencies['expo-file-system'],'~58.0.14');
assert.match(root,/<AdhanPlaybackProvider>[\s\S]*?<Navigation\/>/,
  'player must be mounted above navigation to survive tab changes');
assert.match(provider,/shouldPlayInBackground:true/);
assert.match(provider,/player\.setActiveForLockScreen\(true,/);
assert.match(provider,/player\.setActiveForLockScreen\(false\)/);
assert.match(provider,/File\.pickFileAsync\(/);
assert.match(provider,/camideyiz_user_adhan\.mp3/);
assert.match(provider,/file\.copy\(staged,\{overwrite:true\}\)/);
assert.match(provider,/staged\.move\(final,\{overwrite:true\}\)/);
assert.match(provider,/validPersonalRecording/);
assert.match(provider,/setPersonalRecording\(true\)/);
assert.match(card,/useAdhanPlayback/);
assert.match(card,/MP3 seç/);
assert.match(service,/new File\(getFilesDir\(\),"camideyiz_user_adhan\.mp3"\)/);
assert.match(service,/personal\.getAbsolutePath\(\)/);
assert.match(service,/MediaPlayer\.create\(this,R\.raw\.camideyiz_adhan\)/,
  'if a private file disappears, native alarm must have a licensed local fallback');
assert.ok(!read('scripts/prepare-adhan-audio.mjs').includes('konyacami.com'),
  'do not silently redistribute unlicensed third-party recording');
console.log('Audio QA: background mode, persistent player, lock-screen controls, private MP3 import and native alarm file selection verified');
