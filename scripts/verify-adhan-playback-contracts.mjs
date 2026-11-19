import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
const location=p=>resolve(import.meta.dirname,'..',p);
const read=p=>readFileSync(location(p),'utf8');
const config=JSON.parse(read('apps/mobile/app.json')).expo;
const root=read('apps/mobile/src/app/_layout.tsx');
const player=read('apps/mobile/src/features/adhan/AdhanPlaybackProvider.tsx');
const card=read('apps/mobile/src/features/adhan/AdhanExperience.tsx');
const service=read('apps/mobile/plugins/adhan-native/AdhanPlaybackService.java');
const scheduler=read('apps/mobile/plugins/adhan-native/AdhanAlarmScheduler.java');
const android=read('apps/mobile/plugins/withNativeAdhanAlarm.js');
const prepare=read('scripts/prepare-adhan-audio.mjs');
const plugin=config.plugins.find(x=>Array.isArray(x)&&x[0]==='expo-audio');
assert.ok(plugin&&plugin[1].enableBackgroundPlayback===true,
  'Android/iOS must support background audio');
assert.equal(plugin[1].enableBackgroundRecording,false);
assert.match(root,/<AdhanPlaybackProvider>[\s\S]*?<Navigation\/>/,
  'The manual player must survive navigation');
assert.match(player,/shouldPlayInBackground:true/);
assert.match(player,/player\.setActiveForLockScreen\(true,/);
assert.match(player,/player\.setActiveForLockScreen\(false\)/);
assert.match(player,/assets\/audio\/camideyiz-biz-ezan\.mp3/);
assert.match(card,/useAdhanPlayback/);
assert.doesNotMatch(card,/MP3 seç|MP3.ü değiştir|Varsayılana dön|importRecording/);
assert.doesNotMatch(player,/pickFileAsync|importRecording|personalRecording/);
assert.match(service,/MediaPlayer\.create\(this,R\.raw\.camideyiz_adhan\)/);
assert.match(scheduler,/normalized\.equals\(lastPlanThisProcess\)/,
  'same-process duplicate alarm plan must not churn Android AlarmManager');
assert.match(scheduler,/lastPlanThisProcess=null/,
  'clearing alarms must reset in-process dedupe');
assert.doesNotMatch(scheduler,/normalized\.equals\(local\.getString\(EVENTS/,
  'force-stop removes OS alarms, persisted plan alone cannot suppress reinstallation');
assert.match(scheduler,/schedulePending\(app, input\)/,
  'fresh process must schedule every published prayer alarm');
assert.doesNotMatch(service,/camideyiz_user_adhan\.mp3/);
assert.match(android,/assets','audio','camideyiz-biz-ezan\.mp3/);
assert.match(prepare,/09b6077c9ec6acaa3de1721de4a1f558c9e7ec0044c916d29ba6ea19b53ea77f/);
const audio='apps/mobile/assets/audio/camideyiz-biz-ezan.mp3';
assert.ok(existsSync(location(audio)),'Owner-supplied MP3 is missing; npm run prepare:adhan');
assert.equal(statSync(location(audio)).size,3156985,'Unexpected ezan byte size');
assert.equal(createHash('sha256').update(readFileSync(location(audio))).digest('hex'),
  '09b6077c9ec6acaa3de1721de4a1f558c9e7ec0044c916d29ba6ea19b53ea77f',
  'The bundled audio must be IDENTICAL to the user-uploaded file');
console.log('Ezan QA: exact uploaded MP3, manual button, automatic Android ezan, background playback and removed picker verified');
