package biz.camideyiz.app.adhan;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;

import org.json.JSONObject;

/**
 * System-owned alarms reach this receiver even if the React app is not running.
 * The full ezan replaces the at-time notification, so every path that cannot
 * voice it falls back to an audible "X vakti girdi" notification that states
 * the reason, and the outcome is recorded for the app's ezan status card.
 *
 * "Ezanı test et" goes through the SAME checks: a test that plays proves the
 * real prayer will play; a test that is blocked says exactly why.
 */
public final class AdhanAlarmReceiver extends BroadcastReceiver {
  private static final String TAG="CamideyizAdhan";
  /** Bridges the gap between onReceive returning and the playback service
   * taking its own MediaPlayer wake lock; released by timeout, never leaks. */
  private static final long START_WAKE_MS=20_000L;

  @Override
  public void onReceive(Context context, Intent intent) {
    if(intent==null)return;
    String action=intent.getAction();
    if(AdhanAlarmScheduler.ACTION_FIRE.equals(action)){
      JSONObject alarm=AdhanAlarmScheduler.takeFired(context,intent.getStringExtra("id"));
      if(alarm==null)return; // canceled, duplicate or stale (device was off)
      String id=alarm.optString("id");
      String label=alarm.optString("label","Namaz");
      String time=alarm.optString("time","");
      String place=alarm.optString("place","");
      long lateMs=System.currentTimeMillis()-alarm.optLong("at",0);
      AdhanNotifier.Reason blocked=lateMs>AdhanAlarmScheduler.PLAY_WINDOW_MS
          ?AdhanNotifier.Reason.LATE:audioBlocked(context,playInSilent(context));
      if(blocked!=null){
        AdhanAlarmScheduler.recordOutcome(context,label,blocked.name(),false);
        AdhanNotifier.prayerEntered(context,id,label,time,place,blocked);
        return;
      }
      launch(context,id,label,time,place,false);
    }else if(AdhanAlarmScheduler.ACTION_TEST.equals(action)){
      AdhanNotifier.Reason blocked=audioBlocked(context,playInSilent(context));
      if(blocked!=null){
        AdhanAlarmScheduler.recordOutcome(context,"Test",blocked.name(),true);
        AdhanNotifier.testBlocked(context,blocked);
        return;
      }
      launch(context,"test","Test","","",true);
    }else if(Intent.ACTION_BOOT_COMPLETED.equals(action) ||
             // Some OEM builds (incl. older ColorOS) announce a fast boot this way.
             "android.intent.action.QUICKBOOT_POWERON".equals(action) ||
             Intent.ACTION_TIME_CHANGED.equals(action) ||
             Intent.ACTION_TIMEZONE_CHANGED.equals(action) ||
             Intent.ACTION_MY_PACKAGE_REPLACED.equals(action) ||
             "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED".equals(action)){
      AdhanAlarmScheduler.reschedule(context);
    }
  }

  private static boolean playInSilent(Context context){
    return AdhanAlarmScheduler.prefs(context)
        .getBoolean(AdhanAlarmScheduler.PLAY_IN_SILENT,false);
  }

  static boolean inCall(AudioManager audio){
    int mode=audio.getMode();
    return mode==AudioManager.MODE_IN_CALL||mode==AudioManager.MODE_IN_COMMUNICATION||
        mode==AudioManager.MODE_RINGTONE;
  }

  /**
   * The ezan plays on the ALARM stream, like an alarm clock: a muted media
   * volume no longer silently turns it into a notification. By default a
   * phone on silent/vibrate or Do Not Disturb (meeting, mosque, sleep) never
   * plays it aloud; the user can opt in to "sessizde de oku". Total silence
   * mutes alarms system-wide, so it always falls back to the notification.
   */
  static AdhanNotifier.Reason audioBlocked(Context context,boolean playInSilent){
    AudioManager audio=(AudioManager)context.getSystemService(Context.AUDIO_SERVICE);
    if(audio==null)return null;
    if(inCall(audio))return AdhanNotifier.Reason.BUSY;
    int filter=NotificationManager.INTERRUPTION_FILTER_ALL;
    if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.M){
      NotificationManager manager=context.getSystemService(NotificationManager.class);
      if(manager!=null)filter=manager.getCurrentInterruptionFilter();
    }
    if(filter==NotificationManager.INTERRUPTION_FILTER_NONE)
      return AdhanNotifier.Reason.SILENT;
    if(!playInSilent){
      if(audio.getRingerMode()!=AudioManager.RINGER_MODE_NORMAL)
        return AdhanNotifier.Reason.SILENT;
      if(filter!=NotificationManager.INTERRUPTION_FILTER_ALL&&
         filter!=NotificationManager.INTERRUPTION_FILTER_UNKNOWN)
        return AdhanNotifier.Reason.SILENT;
    }
    if(audio.getStreamVolume(AudioManager.STREAM_ALARM)==0)
      return AdhanNotifier.Reason.MUTED;
    return null;
  }

  private void launch(Context context,String id,String label,String time,String place,
      boolean test) {
    PowerManager power=(PowerManager)context.getSystemService(Context.POWER_SERVICE);
    if(power!=null){
      PowerManager.WakeLock wake=power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,
          "camideyiz:adhan-start");
      wake.setReferenceCounted(false);
      wake.acquire(START_WAKE_MS);
    }
    Intent service=new Intent(context,AdhanPlaybackService.class)
      .setAction(AdhanPlaybackService.ACTION_PLAY)
      .putExtra("id",id)
      .putExtra("label",label)
      .putExtra("time",time)
      .putExtra("place",place)
      .putExtra("test",test);
    try{
      if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.O)context.startForegroundService(service);
      else context.startService(service);
    }catch(Exception e){
      // OEM/background-start restriction: never lose the prayer entry.
      Log.e(TAG,"Could not start full ezan at scheduled prayer time",e);
      AdhanAlarmScheduler.recordOutcome(context,label,AdhanNotifier.Reason.FAILED.name(),test);
      if(test)AdhanNotifier.testBlocked(context,AdhanNotifier.Reason.FAILED);
      else AdhanNotifier.prayerEntered(context,id,label,time,place,
          AdhanNotifier.Reason.FAILED);
    }
  }
}
