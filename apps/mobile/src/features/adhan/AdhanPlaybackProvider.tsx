import {
  createContext,useCallback,useContext,useMemo,type PropsWithChildren,
} from 'react';
import {setAudioModeAsync,useAudioPlayer,useAudioPlayerStatus} from 'expo-audio';

// The exact owner-supplied MP3. The build verifies its SHA-256 and refuses
// missing or changed audio. This recording is never downloaded at runtime.
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

/** Player lives above Expo Router so navigating away doesn't interrupt it. */
export function AdhanPlaybackProvider({children}:PropsWithChildren){
  const player=useAudioPlayer(LOCAL_ADHAN);
  const status=useAudioPlayerStatus(player);
  const playing=Boolean(status.playing);
  const duration=Number.isFinite(status.duration)?Math.max(0,status.duration):0;
  const currentTime=Math.max(0,Math.min(duration,
    Number.isFinite(status.currentTime)?status.currentTime:0));
  const error=status.error?'Ses kaydı açılamadı.':null;

  const pause=useCallback(()=>{
    player.pause();
    try{player.setActiveForLockScreen(false);}catch{/* best effort */}
  },[player]);

  const toggle=useCallback(async()=>{
    try{
      if(player.playing){pause();return;}
      await setAudioModeAsync(BACKGROUND_AUDIO_MODE);
      if(player.duration>0 && player.currentTime>=player.duration-.35)
        await player.seekTo(0);
      player.setActiveForLockScreen(true,ADHAN_METADATA);
      player.play();
    }catch{
      try{player.setActiveForLockScreen(false);}catch{/* best effort */}
    }
  },[player,pause]);

  const seek=useCallback(async(seconds:number)=>{
    const limit=Number.isFinite(player.duration)?Math.max(0,player.duration):0;
    await player.seekTo(Math.max(0,Math.min(limit,seconds)));
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
