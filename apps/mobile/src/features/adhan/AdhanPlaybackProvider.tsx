import {
  createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,
  type PropsWithChildren,
} from 'react';
import {setAudioModeAsync,useAudioPlayer,useAudioPlayerStatus} from 'expo-audio';
import {markStartup} from '@/features/performance/startupMetrics';

// User-approved offline MP3, checked byte-for-byte by the build pipeline.
const LOCAL_ADHAN=require('../../../assets/audio/camideyiz-biz-ezan.mp3');
const ADHAN_METADATA={
  title:'Ezan-ı Şerif',
  artist:'Camideyiz Biz',
  albumTitle:'Ezan ve Dua',
};
const BACKGROUND_AUDIO_MODE={
  playsInSilentMode:true,
  shouldPlayInBackground:true,
  interruptionMode:'doNotMix' as const,
};
const PRELOAD_AFTER_PAINT_MS=700;
const LOAD_TIMEOUT_MS=15_000;
type AdhanPlayback={
  playing:boolean;starting:boolean;loaded:boolean;
  currentTime:number;duration:number;error:string|null;
  toggle:()=>Promise<void>;
  pause:()=>void;
  seek:(seconds:number)=>Promise<void>;
};
const Context=createContext<AdhanPlayback|null>(null);

/**
 * The app's first paint never waits for a 3.1MB MP3 decoder. A player without
 * a source mounts cheaply; once the screen has painted we preload the local
 * file. The first user tap always queues intent until BOTH session setup and
 * native isLoaded are true. Never swallow an audio failure silently.
 *
 * This single player stays above Expo Router. Android lock screen background
 * playback remains controlled by expo-audio's media session.
 */
export function AdhanPlaybackProvider({children}:PropsWithChildren){
  const player=useAudioPlayer(null,{updateInterval:1000});
  const status=useAudioPlayerStatus(player);
  const [starting,setStarting]=useState(false);
  const [modeReady,setModeReady]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const request=useRef(0);
  const sourceRequested=useRef(false);
  const wasPlaying=useRef(false);

  const loaded=Boolean(status.isLoaded);
  const playing=Boolean(status.playing);
  const duration=Number.isFinite(status.duration)?Math.max(0,status.duration):0;
  const currentTime=Math.max(0,Math.min(duration,
    Number.isFinite(status.currentTime)?status.currentTime:0));

  const ensureSource=useCallback(()=>{
    if(sourceRequested.current)return;
    sourceRequested.current=true;
    try{player.replace(LOCAL_ADHAN);}
    catch{
      sourceRequested.current=false;
      setError('Ezan dosyası yüklenemedi. Uygulamayı yeniden açmayı deneyin.');
      setStarting(false);
    }
  },[player]);

  useEffect(()=>{
    const timer=setTimeout(ensureSource,PRELOAD_AFTER_PAINT_MS);
    return ()=>clearTimeout(timer);
  },[ensureSource]);

  const pause=useCallback(()=>{
    request.current++;
    setStarting(false);
    try{player.pause();player.setActiveForLockScreen(false);}
    catch{setError('Ezan durdurulamadı.');}
  },[player]);

  const toggle=useCallback(async()=>{
    if(playing||starting){pause();return;}
    const version=++request.current;
    markStartup('audio-first-tap');
    setError(null);
    setStarting(true); // immediate user feedback before any native IO
    ensureSource();
    try{
      // Do not block mounting/Home render by setting up the audio session
      // at app start. Configure it only when the user actually presses Play.
      await setAudioModeAsync(BACKGROUND_AUDIO_MODE);
      if(version===request.current)setModeReady(true);
    }catch{
      if(version===request.current){
        setStarting(false);
        setError('Ses oturumu başlatılamadı. Telefonun ses ayarlarını kontrol edin.');
      }
    }
  },[playing,starting,pause,ensureSource]);

  // A pending tap is NOT discarded when native MP3 loading finishes later.
  useEffect(()=>{
    if(!starting||!modeReady||!loaded)return;
    try{
      if(player.duration>0&&player.currentTime>=player.duration-.35)
        void player.seekTo(0).then(()=>player.play())
          .catch(()=>setError('Ezan yeniden başlatılamadı.'));
      else player.play();
      // Lock-screen controls are a feature, not a condition of playback.
      try{player.setActiveForLockScreen(true,ADHAN_METADATA);}
      catch{/* Audio can still play in foreground. */}
      setStarting(false);
    }catch{
      setStarting(false);
      setError('Ezan çalınamadı. Ses kaydını ve cihaz ses düzeyini kontrol edin.');
    }
  },[starting,modeReady,loaded,player]);

  useEffect(()=>{
    if(!starting)return;
    const timer=setTimeout(()=>{
      if(starting){
        request.current++;
        setStarting(false);
        setError('Ezan yüklenmesi gecikti. Tekrar dokunarak yeniden deneyebilirsiniz.');
      }
    },LOAD_TIMEOUT_MS);
    return ()=>clearTimeout(timer);
  },[starting]);

  useEffect(()=>{
    if(playing){
      markStartup('audio-first-playing');
      wasPlaying.current=true;
      return;
    }
    if(wasPlaying.current&&!starting){
      wasPlaying.current=false;
      try{player.setActiveForLockScreen(false);}catch{/* optional */}
    }
  },[playing,starting,player]);

  const seek=useCallback(async(seconds:number)=>{
    try{
      if(!status.isLoaded){ensureSource();return;}
      const limit=Number.isFinite(player.duration)?Math.max(0,player.duration):0;
      await player.seekTo(Math.max(0,Math.min(limit,seconds)));
    }catch{setError('Ses kaydında ilerleme yapılamadı.');}
  },[player,status.isLoaded,ensureSource]);

  const value=useMemo(()=>({
    playing,starting,loaded,currentTime,duration,
    error:error??status.error??null,toggle,pause,seek,
  }),[playing,starting,loaded,currentTime,duration,error,status.error,toggle,pause,seek]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAdhanPlayback():AdhanPlayback{
  const context=useContext(Context);
  if(!context)throw Error('useAdhanPlayback must be under AdhanPlaybackProvider');
  return context;
}
