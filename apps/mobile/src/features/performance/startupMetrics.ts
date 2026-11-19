/**
 * Device-only JS timing markers. No network analytics or persistent PII.
 * First mark times are measured from THIS JS process start, not the last
 * time the app became active after being backgrounded.
 */
import {AppState} from 'react-native';

const bootAt=Date.now();
const marks:Record<string,number>={};
export type StartupMark=
  'home-first-frame'|'published-cache-ready'|'published-network-ready'|
  'native-maintenance-start'|'widget-healthy-skip'|'widget-publish-needed'|
  'audio-source-request'|'audio-source-ready'|
  'audio-first-tap'|'audio-first-playing';

let monitorUsers=0;
let listener:{remove:()=>void}|null=null;
let heartbeat:ReturnType<typeof setInterval>|null=null;
let lastTick=0;
let monitorState=AppState.currentState;
let foregroundSessions=0;
let sessionStartedAt=Date.now();
let worstEventLoopLag=0;
let gapsOver500Ms=0;
let gapsOver2000Ms=0;
let lastLongGapAtMs:number|null=null;
let totalSampledMs=0;
const HEARTBEAT_MS=250;

export function markStartup(name:StartupMark):void{
  if(marks[name]!==undefined)return;
  marks[name]=Math.max(0,Date.now()-bootAt);
}
export function startStartupPerformanceMonitor():()=>void{
  monitorUsers++;
  if(monitorUsers===1){
    lastTick=Date.now();
    monitorState=AppState.currentState;
    listener=AppState.addEventListener('change',state=>{
      monitorState=state;
      if(state==='active'){
        foregroundSessions++;
        sessionStartedAt=Date.now();
        // Android suspends JS timers in the background; that is NOT a JS
        // thread stall and must not inflate the event-loop lag metric.
        lastTick=Date.now();
      }else{
        lastTick=Date.now();
      }
    });
    heartbeat=setInterval(()=>{
      const now=Date.now();
      const elapsed=now-lastTick;
      lastTick=now;
      if(monitorState!=='active'||elapsed<0)return;
      totalSampledMs+=elapsed;
      const lag=Math.max(0,elapsed-HEARTBEAT_MS);
      if(lag>worstEventLoopLag)worstEventLoopLag=lag;
      if(lag>500){gapsOver500Ms++;lastLongGapAtMs=now-bootAt;}
      if(lag>2000)gapsOver2000Ms++;
    },HEARTBEAT_MS);
  }
  return ()=>{
    monitorUsers=Math.max(0,monitorUsers-1);
    if(monitorUsers===0){
      if(heartbeat!==null)clearInterval(heartbeat);
      heartbeat=null;
      listener?.remove();
      listener=null;
    }
  };
}
export function readStartupDiagnostics(){
  const delta=marks['audio-first-playing']!==undefined&&
    marks['audio-first-tap']!==undefined
    ?Math.max(0,marks['audio-first-playing']-marks['audio-first-tap']):null;
  return {
    origin:'JS process entry, not Android first rendered pixel',
    elapsedAtReportMs:Math.max(0,Date.now()-bootAt),
    marksMs:{...marks},
    firstAudioTapToPlayingMs:delta,
    monitor:{
      currentAppState:monitorState,
      foregroundResumesObserved:foregroundSessions,
      latestForegroundSessionAgeMs:Math.max(0,Date.now()-sessionStartedAt),
      samplePeriodMs:HEARTBEAT_MS,
      activeSampledMs:totalSampledMs,
      worstEventLoopLagMs:worstEventLoopLag,
      gapsOver500Ms,gapsOver2000Ms,lastLongGapAtMs,
      note:'Background suspension may not always emit an AppState transition before a device pause.',
    },
  };
}
