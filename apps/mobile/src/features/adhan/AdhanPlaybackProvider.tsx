import {
  createContext,useCallback,useContext,useEffect,useMemo,useState,
  type PropsWithChildren,
} from 'react';
import {setAudioModeAsync,useAudioPlayer,useAudioPlayerStatus} from 'expo-audio';
import {File,FileMode,Paths} from 'expo-file-system';

// Offline CC0 recording. Do not silently replace with a third-party
// recording lacking permission to redistribute in an app.
const LOCAL_ADHAN=require('../../../assets/audio/beautiful-adhan.mp3');
/** Android's native AdhanPlaybackService reads this exact private filename
 * from Context.getFilesDir(); iOS reads the same Expo document file. */
const USER_ADHAN_NAME='camideyiz_user_adhan.mp3';
const MIN_MP3_BYTES=200_000;
const MAX_MP3_BYTES=12_000_000;
function privateRecording(){return new File(Paths.document,USER_ADHAN_NAME);}
function validPersonalRecording(file:File){
  if(!file.exists||file.size<MIN_MP3_BYTES||file.size>MAX_MP3_BYTES)return false;
  let handle;
  try{
    handle=file.open(FileMode.ReadOnly);
    const header=handle.readBytesSync(4);
    return (header[0]===0x49&&header[1]===0x44&&header[2]===0x33)||
      (header[0]===0xff&&(header[1]&0xe0)===0xe0);
  }catch{return false;}
  finally{try{handle?.close();}catch{/* device permission / unmounted */}}
}

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
  personalRecording:boolean;
  importRecording:()=>Promise<boolean>;
  restoreDefault:()=>void;
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
  const [personalRecording,setPersonalRecording]=useState(false);

  useEffect(()=>{
    // Restore the user's own local MP3 after a normal app restart.
    const file=privateRecording();
    if(validPersonalRecording(file)){
      try{player.replace({uri:file.uri});setPersonalRecording(true);}
      catch{setError('Seçilen MP3 açılamadı. Varsayılan kayıt kullanılacak.');}
    }
  },[player]);
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
      player.setActiveForLockScreen(true,personalRecording
        ?{...ADHAN_METADATA,artist:'Camideyiz Biz · Seçilen kişisel kayıt'}
        :ADHAN_METADATA);
      player.play();
    }catch{
      try{player.setActiveForLockScreen(false);}catch{/* no-op */}
      setError('Ezan başlatılamadı. Ses ve arka plan ayarlarını kontrol edin.');
    }
  },[player,pause,personalRecording]);

  const seek=useCallback(async(seconds:number)=>{
    setError(null);
    try{
      const limit=Number.isFinite(player.duration)?Math.max(0,player.duration):0;
      await player.seekTo(Math.max(0,Math.min(limit,seconds)));
    }catch{setError('Ses kaydında ilerleme yapılamadı.');}
  },[player]);

  const importRecording=useCallback(async():Promise<boolean>=>{
    setError(null);
    try{
      // The user chooses a recording from their own device. This app never
      // fetches or republishes third-party MP3 files on their behalf.
      const picked=await File.pickFileAsync({
        mimeTypes:['audio/*'],multipleFiles:false,
      });
      if(picked.canceled||!picked.result)return false;
      const file=picked.result;
      if(!/\.mp3$/i.test(file.name)||!validPersonalRecording(file))
        throw Error('Lütfen geçerli, 200 KB–12 MB arasında bir MP3 seçin.');
      pause();
      const staged=new File(Paths.document,'camideyiz_user_adhan_stage.mp3');
      const final=privateRecording();
      await file.copy(staged,{overwrite:true});
      if(!validPersonalRecording(staged))throw Error('MP3 dosyası kopyalanamadı.');
      await staged.move(final,{overwrite:true});
      player.replace({uri:final.uri});
      setPersonalRecording(true);
      return true;
    }catch(e){
      setError(e instanceof Error?e.message:'MP3 seçimi tamamlanamadı.');
      return false;
    }
  },[player,pause]);

  const restoreDefault=useCallback(()=>{
    try{
      pause();
      player.replace(LOCAL_ADHAN);
      const chosen=privateRecording();
      if(chosen.exists)chosen.delete();
      setPersonalRecording(false);
      setError(null);
    }catch{setError('Varsayılan kayıt geri yüklenemedi.');}
  },[player,pause]);

  const value=useMemo(()=>({
    playing,currentTime,duration,error,toggle,pause,seek,personalRecording,
    importRecording,restoreDefault,
  }),[playing,currentTime,duration,error,toggle,pause,seek,
    personalRecording,importRecording,restoreDefault]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAdhanPlayback():AdhanPlayback{
  const context=useContext(Context);
  if(!context)throw Error('useAdhanPlayback must be under AdhanPlaybackProvider');
  return context;
}
