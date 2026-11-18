/**
 * Device-local first-open timing marks. No analytics SDK, PII, network
 * upload, high-frequency timers or persistent storage. Mark names are fixed.
 * The times measure JS lifecycle boundaries, NOT native screen pixels.
 */
const bootAt=Date.now();
const marks:Record<string,number>={};
export type StartupMark=
  'home-first-frame'|'published-cache-ready'|'published-network-ready'|
  'native-maintenance-start'|'audio-first-tap'|'audio-first-playing';
export function markStartup(name:StartupMark):void{
  if(marks[name]!==undefined)return;
  marks[name]=Math.max(0,Date.now()-bootAt);
}
export function readStartupDiagnostics(){
  const delta=marks['audio-first-playing']!==undefined&&
    marks['audio-first-tap']!==undefined
    ?Math.max(0,marks['audio-first-playing']-marks['audio-first-tap']):null;
  return {
    origin:'JS entry; not physical screen pixel timing',
    elapsedAtReportMs:Math.max(0,Date.now()-bootAt),
    marksMs:{...marks},
    firstAudioTapToPlayingMs:delta,
  };
}
