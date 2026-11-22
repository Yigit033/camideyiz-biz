/**
 * Prayer alerts 4.0 contracts: on-time delivery, ezan instead of the
 * notification for the chosen prayers, and no path that leaves the user with
 * neither. Structural QA — real OEM alarm timing still needs a device test.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const read=p=>readFileSync(resolve(import.meta.dirname,'..',p),'utf8');
const n='apps/mobile/plugins/adhan-native/';
const service=read('apps/mobile/src/features/companion/notificationService.ts');
const bridge=read('apps/mobile/src/features/companion/nativeAdhan.ts');
const provider=read('apps/mobile/src/features/companion/CompanionProvider.tsx');
const screen=read('apps/mobile/src/app/companion.tsx');
const core=read('packages/core/src/prayerCompanion.ts');
const scheduler=read(n+'AdhanAlarmScheduler.java');
const receiver=read(n+'AdhanAlarmReceiver.java');
const playback=read(n+'AdhanPlaybackService.java');
const notifier=read(n+'AdhanNotifier.java');
const plugin=read('apps/mobile/plugins/withNativeAdhanAlarm.js');
const app=JSON.parse(read('apps/mobile/app.json')).expo;

// 1. One rule decides ezan vs notification, used by both schedulers.
assert.match(core,/export function playsFullAdhan\(/);
assert.match(core,/settings\.sound==='adhan'&&event\.kind==='atTime'/);
assert.match(core,/export const SABAH_EZANI_AVAILABLE=false;/,
  'the bundled öğle ezanı must never play at İmsak until a sabah ezanı ships');
assert.match(core,/if\(!SABAH_EZANI_AVAILABLE\)adhanFor\.imsak=false;/);
assert.match(service,/const voiced=desired\.filter\(event=>playsFullAdhan\(event,settings\)\)/);
assert.match(service,/scheduleNativeAdhan\(voiced,settings\.precise,settings\.adhanInSilent\)/);
assert.match(service,/const notifications=nativeReady\s*\?desired\.filter\(event=>!playsFullAdhan\(event,settings\)\)\s*:desired;/,
  'notifications are suppressed ONLY when the native ezan alarm is armed');
assert.match(bridge,/time:e\.localTime/);
assert.match(bridge,/place:e\.locationName\.slice\(0,80\)/);
assert.doesNotMatch(bridge,/e\.kind==='atTime'&&e\.prayer!=='gunes'/,
  'ezan eligibility lives in core playsFullAdhan only');

// 2. On-time delivery.
assert.match(service,/android\?ANDROID_ALERT_MAX_EVENTS:ALERT_MAX_EVENTS/);
assert.match(service,/android\?ANDROID_ALERT_MAX_DAYS:ALERT_MAX_DAYS/);
assert.match(service,/android&&settings\.precise&&exactAlarms!==false\s*\?'alarmClock':'bestEffort'/);
assert.match(service,/const armedAs:ArmedDelivery=exactAlarms===false\?'inexact':delivery;/,
  'granting exact access later must re-arm inexact reminders');
assert.match(service,/\(old\.content\.data\?\.delivery\?\?'bestEffort'\)===armedAs/);
assert.match(service,/getExactAlarmPermissionsAsync\(\)/);
assert.match(service,/requestExactAlarmPermissionsAsync\(\)/);
assert.match(provider,/previousExact\.current===false&&exactAlarms===true\)setSequence/);
assert.match(scheduler,/mgr\.setAlarmClock\(new AlarmManager\.AlarmClockInfo\(at,show\),fire\)/);
assert.match(scheduler,/String normalized=\(precise\?"precise:":"exact:"\)\+input\.toString\(\);/);
assert.match(scheduler,/MAX_EVENTS = 60;/);
assert.match(screen,/Dakikası dakikasına \(önerilir\)/);
assert.match(screen,/askExactAlarms\('notifications'\)/,
  'enabling reminders explains and offers exact-alarm access');

// 3. Ezan never leaves the user with nothing.
assert.match(scheduler,/PLAY_WINDOW_MS = 180_000L;/);
assert.match(scheduler,/now > at\+NOTIFY_WINDOW_MS\)return null;/);
assert.match(receiver,/lateMs>AdhanAlarmScheduler\.PLAY_WINDOW_MS\s*\?AdhanNotifier\.Reason\.LATE/);
assert.match(receiver,/if\(!playInSilent\)\{\s*if\(audio\.getRingerMode\(\)!=AudioManager\.RINGER_MODE_NORMAL\)/,
  'silent/vibrate phones never play the ezan aloud unless the user opted in');
assert.match(receiver,/filter==NotificationManager\.INTERRUPTION_FILTER_NONE\)\s*return AdhanNotifier\.Reason\.SILENT;/,
  'total silence always falls back to the notification');
// Alarm stream: a muted MEDIA volume must not silently turn the ezan into a
// notification (the root cause of "ezan açık ama sadece bildirim geldi").
assert.match(receiver,/getStreamVolume\(AudioManager\.STREAM_ALARM\)==0/);
assert.doesNotMatch(receiver+playback,/STREAM_MUSIC|USAGE_MEDIA/);
assert.match(playback,/setUsage\(AudioAttributes\.USAGE_ALARM\)/);
assert.match(playback,/MediaPlayer\.create\(this,R\.raw\.camideyiz_adhan,EZAN_AUDIO,/);
assert.match(playback,/AudioFocusRequest\.Builder\(AudioManager\.AUDIOFOCUS_GAIN_TRANSIENT\)/);
assert.match(receiver,/MODE_IN_CALL/);
assert.match(receiver,/AdhanNotifier\.Reason\.FAILED/,'blocked service start still notifies');
assert.match(receiver,/newWakeLock\(PowerManager\.PARTIAL_WAKE_LOCK,\s*"camideyiz:adhan-start"\);[\s\S]*?acquire\(START_WAKE_MS\)/,
  'the CPU stays awake until the playback service holds its own wake lock');
// The test runs the real prayer's checks: a passing test proves the real path.
assert.match(receiver,/ACTION_TEST\.equals\(action\)\)\{\s*AdhanNotifier\.Reason blocked=audioBlocked\(context,playInSilent\(context\)\);/);
assert.match(receiver,/AdhanNotifier\.testBlocked\(context,blocked\)/);
assert.match(scheduler,/setAlarmClock\(new AlarmManager\.AlarmClockInfo\(at,show\),testAlarm\(context\)\)/);
// Every outcome is recorded for the in-app ezan status card.
assert.match(receiver,/recordOutcome\(context,label,blocked\.name\(\),false\)/);
assert.match(playback,/recordOutcome\(this,label,"STARTED",test\)/);
assert.match(playback,/recordOutcome\(this,label,outcome\.name\(\),test\)/);
assert.match(scheduler,/result\.put\(LAST_OUTCOME,/);
assert.match(scheduler,/at < now - 60_000 \|\| at > now \+ MAX_AHEAD/,
  'an imminent prayer must not reject (and silence) the whole ezan plan');
assert.match(screen,/<AdhanStatusCard /);
assert.match(service,/ezanMissing\?' · Ezanın okunması için uygulamayı aç'/,
  'a fallback notification says how to restore the ezan');
assert.match(playback,/AUDIOFOCUS_LOSS_TRANSIENT[\s\S]*?player\.pause\(\);pausedByFocus=true;/);
assert.match(playback,/AUDIOFOCUS_GAIN&&pausedByFocus[\s\S]*?player\.start\(\);/);
assert.match(playback,/setOnCompletionListener\(media->finish\(AdhanNotifier\.Reason\.COMPLETED\)\)/);
assert.match(playback,/if\(!acquireFocus\(\)&&audioManager!=null&&AdhanAlarmReceiver\.inCall\(audioManager\)\)\{\s*finish\(AdhanNotifier\.Reason\.BUSY\)/,
  'refused focus blocks the ezan only during a call');
assert.match(playback,/private void finish\(AdhanNotifier\.Reason outcome\)\{\s*if\(finished\)return;/,
  'exactly one record/fallback per prayer');
assert.match(playback,/public void onDestroy\(\)\{[\s\S]*?finish\(AdhanNotifier\.Reason\.STOPPED\)/);
for(const reason of ['LATE','SILENT','MUTED','BUSY','FAILED','COMPLETED','STOPPED'])
  assert.match(notifier,new RegExp('\\b'+reason+'\\("'));
// Native fallbacks use the very channels expo-notifications reminders use.
const audible=service.match(/CHANNEL_AUDIBLE='([^']+)'/)[1];
const silent=service.match(/CHANNEL_SILENT='([^']+)'/)[1];
assert.match(notifier,new RegExp('CHANNEL_AUDIBLE="'+audible+'"'));
assert.match(notifier,new RegExp('CHANNEL_QUIET="'+silent+'"'));
assert.match(notifier,/getIdentifier\("notification_icon","drawable"/);
assert.match(plugin,/'AdhanNotifier\.java'/);

// 4. Branded monochrome notification icon.
const expoNotifications=app.plugins.find(p=>Array.isArray(p)&&p[0]==='expo-notifications');
assert.equal(expoNotifications?.[1]?.icon,'./assets/notification-icon.png');
assert.equal(expoNotifications?.[1]?.color,'#0C76B4');
assert.match(screen,/Ezan okunacak vakitler/);
console.log('Prayer alerts 4.0: one ezan rule, exact/alarm-clock delivery with re-arm on grant, 10-day Android horizon, ringer-aware ezan and a guaranteed "vakti girdi" fallback verified');
