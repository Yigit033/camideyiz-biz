import {
  createContext,useCallback,useContext,useEffect,useMemo,useState,
  type PropsWithChildren,
} from 'react';
import {setAudioModeAsync,useAudioPlayer,useAudioPlayerStatus} from 'expo-audio';

// Offline CC0 recording. Do not silently replace with a third-party
// recording lacking permission to redistribute in an app.
const LOCAL_ADHAN=require('../../../assets/audio/beautiful-adhan.mp3');

const ADHAN_METADATA={
  title:'Ezan-ı Şerif',
  artist:'Camideyiz Biz · Çevrimdışı dinleme',
  albumTitle:'Ezan ve Dua',
};
const BACKGROUND_AUDIO_MODE={
  playsInSilentMode:true,
  shouldPlayInBackground:true,
  interruptionMode:'doNotMix' as const,
};
type AdhanPlayback={
  playing:boolean;
  currentTime:number;
  duration:number;
  error:string|null;
  toggle:()=>Promise<void>;
  pause:()=>void;
  seek:(seconds:number)=>Promise<void>;
};
const Context=createContext<AdhanPlayback|null>(null);

/**
 * Keep a single player mounted above Expo Router's Stack. Navigating away
 * from Home must not release the player or interrupt user-initiated audio.
 * Native media session/foreground service lives in expo-audio SDK 58.
 */
export function AdhanPlaybackProvider({children}:PropsWithChildren){
  const player=useAudioPlayer(LOCAL_ADHAN);
  const status=useAudioPlayerStatus(player);
  const [error,setError]=useState<string|null>(null);
  const playing=Boolean(status.playing);
  const duration=Number.isFinite(status.duration)?Math.max(0,status.duration):0;
  const currentTime=Math.max(0,Math.min(duration,
    Number.isFinite(status.currentTime)?status.currentTime:0));

  // The lock-screen media notification is needed for Android sustained
  // background playback. Release it on pause, completion, or an audio error.
  useEffect(()=>{
    if(!playing){
      try{player.setActiveForLockScreen(false);}catch{/* missing native module */}
    }
  },[playing,player]);

  const pause=useCallback(()=>{
    player.pause();
    try{player.setActiveForLockScreen(false);}catch{/* best effort */}
  },[player]);

  const toggle=useCallback(async()=>{
    setError(null);
    try{
      if(player.playing){pause();return;}
      await setAudioModeAsync(BACKGROUND_AUDIO_MODE);
      if(player.duration>0 && player.currentTime>=player.duration-.35)
        await player.seekTo(0);
      // Required on Android for sustained playback when the screen locks.
      player.setActiveForLockScreen(true,ADHAN_METADATA);
      player.play();
    }catch{
      try{player.setActiveForLockScreen(false);}catch{/* no-op */}
      setError('Ezan başlatılamadı. Ses ve arka plan ayarlarını kontrol edin.');
    }
  },[player,pause]);

  const seek=useCallback(async(seconds:number)=>{
    setError(null);
    try{
      const limit=Number.isFinite(player.duration)?Math.max(0,player.duration):0;
      await player.seekTo(Math.max(0,Math.min(limit,seconds)));
    }catch{setError('Ses kaydında ilerleme yapılamadı.');}
  },[player]);

  const value=useMemo(()=>({
    playing,currentTime,duration,error,toggle,pause,seek,
  }),[playing,currentTime,duration,error,toggle,pause,seek]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAdhanPlayback():AdhanPlayback{
  const context=useContext(Context);
  if(!context)throw Error('useAdhanPlayback must be under AdhanPlaybackProvider');
  return context;
}
