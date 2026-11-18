package biz.camideyiz.app.adhan;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import java.io.File;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

import biz.camideyiz.app.R;

/**
 * Native foreground playback; works without React JS execution and never
 * fetches audio from a network. Respects the user's media volume and DND.
 * Always exposes a system STOP action; never bypasses silent/DND settings.
 */
public final class AdhanPlaybackService extends Service {
  public static final String ACTION_PLAY="biz.camideyiz.app.adhan.PLAY";
  public static final String ACTION_STOP="biz.camideyiz.app.adhan.STOP";
  private static final String CHANNEL="camideyiz-adhan-playback-v1";
  private static final int NOTIFICATION_ID=748039;
  private static final String TAG="CamideyizAdhan";
  private MediaPlayer player;
  private AudioManager audioManager;
  private AudioFocusRequest focusRequest;
  private final AudioManager.OnAudioFocusChangeListener focusListener=focus->{
    if(focus==AudioManager.AUDIOFOCUS_LOSS ||
       focus==AudioManager.AUDIOFOCUS_LOSS_TRANSIENT){
      stopSelf();
    }
  };

  @Override public IBinder onBind(Intent intent){return null;}

  private void makeNotificationChannel(){
    if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.O){
      NotificationChannel channel=new NotificationChannel(CHANNEL,
          "Ezan çalınıyor",NotificationManager.IMPORTANCE_LOW);
      channel.setSound(null,null);
      channel.enableVibration(false);
      NotificationManager manager=getSystemService(NotificationManager.class);
      if(manager!=null)manager.createNotificationChannel(channel);
    }
  }

  private Notification playbackNotification(String label){
    Intent stop=new Intent(this,AdhanPlaybackService.class).setAction(ACTION_STOP);
    PendingIntent stopPending=PendingIntent.getService(this,748032,stop,
        PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    Intent launch=getPackageManager().getLaunchIntentForPackage(getPackageName());
    Notification.Builder b;
    if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.O)b=new Notification.Builder(this,CHANNEL);
    else b=new Notification.Builder(this);
    b.setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setContentTitle("Camideyiz Biz · "+label+" ezanı")
      .setContentText("Ezan okunuyor · Durdurmak için dokunun")
      .setOnlyAlertOnce(true)
      .setOngoing(true)
      .setCategory(Notification.CATEGORY_SERVICE)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setPriority(Notification.PRIORITY_LOW)
      .addAction(android.R.drawable.ic_media_pause,"Ezanı durdur",stopPending);
    if(launch!=null){
      launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP);
      b.setContentIntent(PendingIntent.getActivity(this,748033,launch,
          PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));
    }
    return b.build();
  }

  private void beginForeground(String label){
    makeNotificationChannel();
    Notification notification=playbackNotification(label);
    if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.Q)
      startForeground(NOTIFICATION_ID,notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
    else startForeground(NOTIFICATION_ID,notification);
  }

  private boolean acquireFocus(){
    audioManager=(AudioManager)getSystemService(AUDIO_SERVICE);
    if(audioManager==null)return false;
    if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.O){
      AudioAttributes attr=new AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_MEDIA)
          .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build();
      focusRequest=new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
          .setAudioAttributes(attr).setOnAudioFocusChangeListener(focusListener).build();
      return audioManager.requestAudioFocus(focusRequest)==AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
    }
    return audioManager.requestAudioFocus(focusListener,
        AudioManager.STREAM_MUSIC,AudioManager.AUDIOFOCUS_GAIN)
        ==AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
  }

  private void releaseResources(){
    if(player!=null){
      try{player.setOnCompletionListener(null);player.stop();}catch(Exception ignored){}
      try{player.release();}catch(Exception ignored){}
      player=null;
    }
    if(audioManager!=null){
      if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.O && focusRequest!=null)
        audioManager.abandonAudioFocusRequest(focusRequest);
      else audioManager.abandonAudioFocus(focusListener);
      audioManager=null;
      focusRequest=null;
    }
  }

  @Override public int onStartCommand(Intent intent,int flags,int startId){
    if(intent==null || ACTION_STOP.equals(intent.getAction())){
      stopSelf();
      return START_NOT_STICKY;
    }
    if(!ACTION_PLAY.equals(intent.getAction())){
      stopSelf();
      return START_NOT_STICKY;
    }
    releaseResources();
    String label=intent.getStringExtra("label");
    if(label==null||label.trim().isEmpty())label="Namaz";
    try{
      beginForeground(label);
      if(!acquireFocus())throw new IllegalStateException("Ses odağı alınamadı");
      // Optional personal MP3 stays only in the app's private files folder,
      // never embedded or redistributed in the APK. Expo FileSystem
      // Paths.document maps to Context.getFilesDir() on Android.
      File personal=new File(getFilesDir(),"camideyiz_user_adhan.mp3");
      if(personal.isFile()&&personal.length()>=200_000&&personal.length()<=12_000_000){
        MediaPlayer custom=null;
        try{
          custom=new MediaPlayer();
          custom.setAudioAttributes(new AudioAttributes.Builder()
              .setUsage(AudioAttributes.USAGE_MEDIA)
              .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build());
          custom.setDataSource(personal.getAbsolutePath());
          custom.prepare();
          player=custom;
        }catch(Exception invalid){
          Log.w(TAG,"Selected personal ezan file unavailable; reverting to packaged default",invalid);
          if(custom!=null)try{custom.release();}catch(Exception ignored){}
          player=null;
        }
      }
      if(player==null)player=MediaPlayer.create(this,R.raw.camideyiz_adhan);
      if(player==null)throw new IllegalStateException("Paketlenmiş MP3 bulunamadı");
      player.setWakeMode(this,PowerManager.PARTIAL_WAKE_LOCK);
      player.setOnCompletionListener(media->stopSelf());
      player.setOnErrorListener((media,what,extra)->{
        Log.e(TAG,"MediaPlayer failed: "+what+" / "+extra);
        stopSelf();
        return true;
      });
      player.start();
    }catch(Exception error){
      Log.e(TAG,"Ezan çalma başarısız",error);
      stopSelf();
    }
    return START_NOT_STICKY;
  }

  @Override public void onDestroy(){
    releaseResources();
    try{stopForeground(STOP_FOREGROUND_REMOVE);}catch(Exception ignored){}
    super.onDestroy();
  }
}
