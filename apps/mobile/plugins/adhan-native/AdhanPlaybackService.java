package biz.camideyiz.app.adhan;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

import biz.camideyiz.app.R;

/**
 * Native foreground playback; works without React JS execution and never
 * fetches audio from a network. Respects ringer mode and media volume (the
 * receiver checks both first) and always exposes a system STOP action.
 *
 * Every outcome leaves the prayer entry visible: a quiet "vakti girdi"
 * record after the ezan ends or is stopped, an audible fallback if it could
 * not be voiced. Short interruptions (navigation prompt, notification sound)
 * pause and resume the ezan instead of silently ending it.
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
  private boolean pausedByFocus=false;
  private boolean finished=false;
  private String alarmId="";
  private String label="Namaz";
  private String time="";
  private String place="";
  private boolean test=false;

  private final AudioManager.OnAudioFocusChangeListener focusListener=focus->{
    if(player==null)return;
    try{
      if(focus==AudioManager.AUDIOFOCUS_LOSS){
        finish(AdhanNotifier.Reason.STOPPED); // another app took audio for good
      }else if(focus==AudioManager.AUDIOFOCUS_LOSS_TRANSIENT||
               focus==AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK){
        if(player.isPlaying()){player.pause();pausedByFocus=true;}
      }else if(focus==AudioManager.AUDIOFOCUS_GAIN&&pausedByFocus){
        pausedByFocus=false;
        player.start();
      }
    }catch(IllegalStateException error){
      Log.w(TAG,"Focus change after player release",error);
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

  private Notification playbackNotification(){
    Intent stop=new Intent(this,AdhanPlaybackService.class).setAction(ACTION_STOP);
    PendingIntent stopPending=PendingIntent.getService(this,748032,stop,
        PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    Notification.Builder b;
    if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.O)b=new Notification.Builder(this,CHANNEL);
    else b=new Notification.Builder(this);
    String where=(place.isEmpty()?"":place+" · ")+(time.isEmpty()?"":time);
    b.setSmallIcon(AdhanNotifier.smallIcon(this))
      .setColor(Color.parseColor("#0C76B4"))
      .setContentTitle(test?"Ezan testi":label+" vakti girdi · Ezan okunuyor")
      .setContentText(where.isEmpty()?"Durdurmak için “Ezanı durdur”a dokunun":where)
      .setOnlyAlertOnce(true)
      .setOngoing(true)
      .setCategory(Notification.CATEGORY_SERVICE)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setPriority(Notification.PRIORITY_LOW)
      .addAction(android.R.drawable.ic_media_pause,"Ezanı durdur",stopPending);
    PendingIntent open=AdhanNotifier.openApp(this,748033);
    if(open!=null)b.setContentIntent(open);
    return b.build();
  }

  private void beginForeground(){
    makeNotificationChannel();
    Notification notification=playbackNotification();
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
          .setAudioAttributes(attr).setWillPauseWhenDucked(true)
          .setOnAudioFocusChangeListener(focusListener).build();
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
    pausedByFocus=false;
  }

  /** Exactly one outcome per prayer: record or fallback, then stop. */
  private void finish(AdhanNotifier.Reason outcome){
    if(finished)return;
    finished=true;
    releaseResources();
    try{stopForeground(STOP_FOREGROUND_REMOVE);}catch(Exception ignored){}
    if(!test)AdhanNotifier.prayerEntered(this,alarmId,label,time,place,outcome);
    stopSelf();
  }

  @Override public int onStartCommand(Intent intent,int flags,int startId){
    if(intent==null || ACTION_STOP.equals(intent.getAction())){
      if(player!=null&&!finished)finish(AdhanNotifier.Reason.STOPPED);
      else stopSelf();
      return START_NOT_STICKY;
    }
    if(!ACTION_PLAY.equals(intent.getAction())){
      stopSelf();
      return START_NOT_STICKY;
    }
    // A newer prayer supersedes an unfinished one; close the old record first.
    if(player!=null&&!finished)finish(AdhanNotifier.Reason.STOPPED);
    releaseResources();
    finished=false;
    alarmId=valueOr(intent.getStringExtra("id"),"");
    label=valueOr(intent.getStringExtra("label"),"Namaz");
    time=valueOr(intent.getStringExtra("time"),"");
    place=valueOr(intent.getStringExtra("place"),"");
    test=intent.getBooleanExtra("test",false);
    try{
      beginForeground();
    }catch(Exception error){
      Log.e(TAG,"Foreground start refused",error);
      finish(AdhanNotifier.Reason.FAILED);
      return START_NOT_STICKY;
    }
    if(!acquireFocus()){
      finish(AdhanNotifier.Reason.BUSY);
      return START_NOT_STICKY;
    }
    try{
      player=MediaPlayer.create(this,R.raw.camideyiz_adhan);
      if(player==null)throw new IllegalStateException("Paketlenmiş MP3 bulunamadı");
      player.setWakeMode(this,PowerManager.PARTIAL_WAKE_LOCK);
      player.setOnCompletionListener(media->finish(AdhanNotifier.Reason.COMPLETED));
      player.setOnErrorListener((media,what,extra)->{
        Log.e(TAG,"MediaPlayer failed: "+what+" / "+extra);
        finish(AdhanNotifier.Reason.FAILED);
        return true;
      });
      player.start();
    }catch(Exception error){
      Log.e(TAG,"Ezan çalma başarısız",error);
      finish(AdhanNotifier.Reason.FAILED);
    }
    return START_NOT_STICKY;
  }

  private static String valueOr(String value,String fallback){
    return value==null||value.trim().isEmpty()?fallback:value.trim();
  }

  @Override public void onDestroy(){
    // System-initiated destroy mid-ezan still leaves the prayer record.
    if(player!=null&&!finished)finish(AdhanNotifier.Reason.STOPPED);
    releaseResources();
    try{stopForeground(STOP_FOREGROUND_REMOVE);}catch(Exception ignored){}
    super.onDestroy();
  }
}
