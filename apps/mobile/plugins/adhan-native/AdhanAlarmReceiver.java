package biz.camideyiz.app.adhan;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import org.json.JSONObject;

/** System-owned alarms reach this receiver even if the React app is not running. */
public final class AdhanAlarmReceiver extends BroadcastReceiver {
  private static final String TAG="CamideyizAdhan";

  @Override
  public void onReceive(Context context, Intent intent) {
    if(intent==null)return;
    String action=intent.getAction();
    if(AdhanAlarmScheduler.ACTION_FIRE.equals(action)){
      JSONObject alarm=AdhanAlarmScheduler.takeFired(context,intent.getStringExtra("id"));
      if(alarm==null)return; // canceled, stale, duplicate or very late delivery
      launch(context,alarm.optString("label","Namaz"),false);
    }else if(AdhanAlarmScheduler.ACTION_TEST.equals(action)){
      launch(context,"Test",true);
    }else if(Intent.ACTION_BOOT_COMPLETED.equals(action) ||
             Intent.ACTION_TIME_CHANGED.equals(action) ||
             Intent.ACTION_TIMEZONE_CHANGED.equals(action) ||
             Intent.ACTION_MY_PACKAGE_REPLACED.equals(action) ||
             "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED".equals(action)){
      AdhanAlarmScheduler.reschedule(context);
    }
  }

  private void launch(Context context,String label,boolean test) {
    Intent service=new Intent(context,AdhanPlaybackService.class)
      .setAction(AdhanPlaybackService.ACTION_PLAY)
      .putExtra("label",label)
      .putExtra("test",test);
    try{
      if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.O)context.startForegroundService(service);
      else context.startService(service);
    }catch(Exception e){
      // No invisible retries: if OEM prevents service launch, user should
      // diagnose the device's permission/battery policy rather than hear it late.
      Log.e(TAG,"Could not start full ezan at scheduled prayer time",e);
    }
  }
}
