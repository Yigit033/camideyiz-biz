package biz.camideyiz.app.adhan;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.os.Build;
import android.util.Log;

import org.json.JSONObject;

/**
 * System-owned alarms reach this receiver even if the React app is not running.
 * The full ezan replaces the at-time notification, so every path that cannot
 * voice it falls back to an audible "X vakti girdi" notification.
 */
public final class AdhanAlarmReceiver extends BroadcastReceiver {
  private static final String TAG="CamideyizAdhan";

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
          ?AdhanNotifier.Reason.LATE:audioBlocked(context);
      if(blocked!=null){
        AdhanNotifier.prayerEntered(context,id,label,time,place,blocked);
        return;
      }
      launch(context,id,label,time,place,false);
    }else if(AdhanAlarmScheduler.ACTION_TEST.equals(action)){
      launch(context,"test","Test","","",true);
    }else if(Intent.ACTION_BOOT_COMPLETED.equals(action) ||
             Intent.ACTION_TIME_CHANGED.equals(action) ||
             Intent.ACTION_TIMEZONE_CHANGED.equals(action) ||
             Intent.ACTION_MY_PACKAGE_REPLACED.equals(action) ||
             "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED".equals(action)){
      AdhanAlarmScheduler.reschedule(context);
    }
  }

  /** The user's ringer and media volume are respected: a phone on silent or
   * vibrate (meeting, mosque) never plays the ezan aloud. */
  private static AdhanNotifier.Reason audioBlocked(Context context){
    AudioManager audio=(AudioManager)context.getSystemService(Context.AUDIO_SERVICE);
    if(audio==null)return null;
    if(audio.getRingerMode()!=AudioManager.RINGER_MODE_NORMAL)
      return AdhanNotifier.Reason.SILENT;
    if(audio.getStreamVolume(AudioManager.STREAM_MUSIC)==0)
      return AdhanNotifier.Reason.MUTED;
    if(audio.getMode()==AudioManager.MODE_IN_CALL||
       audio.getMode()==AudioManager.MODE_IN_COMMUNICATION)
      return AdhanNotifier.Reason.BUSY;
    return null;
  }

  private void launch(Context context,String id,String label,String time,String place,
      boolean test) {
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
      if(!test)AdhanNotifier.prayerEntered(context,id,label,time,place,
          AdhanNotifier.Reason.FAILED);
    }
  }
}
