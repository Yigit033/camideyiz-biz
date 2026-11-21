package biz.camideyiz.app.adhan;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Only published prayer instants supplied by @camideyiz/core may be scheduled.
 * No native astronomical fallback, remote stream, or background JS runtime.
 *
 * Exact alarms are opt-in: Android 12+ requires special user authorization.
 * Identities are stable across syncs; city switches atomically replace alarms.
 */
public final class AdhanAlarmScheduler {
  static final String ACTION_FIRE = "biz.camideyiz.app.adhan.FIRE";
  static final String ACTION_TEST = "biz.camideyiz.app.adhan.TEST";
  static final String PREFS = "camideyiz.adhan.alarms.v1";
  static final String EVENTS = "events";
  static final String PRECISE = "precise";
  // 5 ezan × 10 verified days (core ANDROID_ALERT_MAX_DAYS) with headroom.
  private static final int MAX_EVENTS = 60;
  private static final long MAX_AHEAD = 11L * 24L * 60L * 60L * 1000L;
  /** Voice the ezan only near its published minute; later deliveries post
   * the "vakti girdi" notification instead of a surprising late ezan. */
  static final long PLAY_WINDOW_MS = 180_000L;
  /** Deliveries later than this are stale (device was off etc.): dropped. */
  static final long NOTIFY_WINDOW_MS = 2L * 60L * 60L * 1000L;
  // Process-local, NOT persisted. Android removes alarms after Force Stop;
  // a subsequent fresh process must rebuild even if SharedPreferences still
  // contains the same plan and timestamp.
  private static String lastPlanThisProcess = null;
  private static long lastPlanAtThisProcess = 0;

  private AdhanAlarmScheduler() {}

  static SharedPreferences prefs(Context context) {
    return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
  }

  private static AlarmManager manager(Context context) {
    return (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
  }

  static boolean canExact(Context context) {
    AlarmManager mgr = manager(context);
    return mgr != null && (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || mgr.canScheduleExactAlarms());
  }

  static void openPermissionSettings(Context context) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
      intent.setData(Uri.parse("package:" + context.getPackageName()));
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      context.startActivity(intent);
    }
  }

  private static PendingIntent alarm(Context context, String id) {
    Intent intent = new Intent(context, AdhanAlarmReceiver.class);
    intent.setAction(ACTION_FIRE);
    intent.setData(Uri.parse("camideyiz-adhan://at/" + Uri.encode(id)));
    intent.putExtra("id", id);
    return PendingIntent.getBroadcast(context, id.hashCode(), intent,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
  }

  private static PendingIntent testAlarm(Context context) {
    Intent intent = new Intent(context, AdhanAlarmReceiver.class).setAction(ACTION_TEST);
    return PendingIntent.getBroadcast(context, 748031, intent,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
  }

  /** Accepts {"precise":bool,"events":[...]} (current) or a bare array
   * (APK/JS version skew during an upgrade → previous inexact-exact API). */
  static synchronized JSONObject replace(Context context, String raw) throws JSONException {
    Context app = context.getApplicationContext();
    String trimmed = raw == null ? "" : raw.trim();
    boolean precise = false;
    JSONArray input;
    if (trimmed.startsWith("{")) {
      JSONObject plan = new JSONObject(trimmed);
      precise = plan.optBoolean(PRECISE, false);
      input = plan.getJSONArray(EVENTS);
    } else {
      input = new JSONArray(trimmed);
    }
    if (input.length() > MAX_EVENTS) throw new JSONException("Too many ezan alarm events");
    long now = System.currentTimeMillis();
    for (int i = 0; i < input.length(); i++) {
      JSONObject item = input.getJSONObject(i);
      String id = item.optString("id", "");
      long at = item.optLong("at", 0);
      String label = item.optString("label", "");
      String time = item.optString("time", "");
      String place = item.optString("place", "");
      if (!id.matches("\\d{4}-\\d{2}-\\d{2}:(imsak|ogle|ikindi|aksam|yatsi):atTime:0") ||
          at < now + 5000 || at > now + MAX_AHEAD ||
          label.isEmpty() || label.length() > 40 ||
          (!time.isEmpty() && !time.matches("([01]\\d|2[0-3]):[0-5]\\d")) ||
          place.length() > 80) {
        throw new JSONException("Invalid prayer alarm entry");
      }
      for (int j = 0; j < i; j++) {
        if (id.equals(input.getJSONObject(j).optString("id"))) {
          throw new JSONException("Duplicate alarm id");
        }
      }
    }
    if (input.length() > 0 && !canExact(app))
      throw new SecurityException("Kesin alarm izni verilmedi");
    SharedPreferences local=prefs(app);
    // Precision is part of the plan identity: toggling it must re-arm.
    String normalized=(precise?"precise:":"exact:")+input.toString();
    // Repeated foreground updates in the SAME live process need no OS write.
    // Always rebuild after a process restart: persisted "events" alone never
    // proves PendingIntent alarms survived Force Stop / OS cleanup.
    if (normalized.equals(lastPlanThisProcess) &&
        lastPlanAtThisProcess>0 && now-lastPlanAtThisProcess>=0 &&
        now-lastPlanAtThisProcess<30L*60L*1000L)
      return status(app);
    // Only a genuinely changed or aging plan is atomically replaced.
    clearPending(app);
    if (!local.edit().putString(EVENTS,input.toString())
        .putBoolean(PRECISE,precise)
        .putLong("lastPlanWrittenAt",now).commit())
      throw new JSONException("Ezan planı kalıcı olarak kaydedilemedi");
    schedulePending(app, input, precise);
    lastPlanThisProcess=normalized;
    lastPlanAtThisProcess=now;
    return status(app);
  }

  static synchronized void clear(Context context) {
    clearPending(context);
    prefs(context).edit().remove(EVENTS).commit();
    lastPlanThisProcess=null;
    lastPlanAtThisProcess=0;
    AlarmManager mgr=manager(context);
    if(mgr!=null)mgr.cancel(testAlarm(context));
  }

  private static void clearPending(Context context) {
    AlarmManager mgr=manager(context);
    if(mgr==null)return;
    JSONArray previous=stored(context);
    for(int i=0;i<previous.length();i++) {
      JSONObject item=previous.optJSONObject(i);
      if(item!=null)mgr.cancel(alarm(context,item.optString("id")));
    }
  }

  /**
   * precise → setAlarmClock: the OS never defers or batches these (OEM
   * battery savers included) and shows the alarm icon until the next ezan.
   * Otherwise setExactAndAllowWhileIdle, which some OEMs defer by minutes.
   */
  private static void schedulePending(Context context, JSONArray entries, boolean precise) {
    AlarmManager mgr=manager(context);
    if(mgr==null || !canExact(context))return;
    final long now=System.currentTimeMillis();
    PendingIntent show=precise?AdhanNotifier.openApp(context,748034):null;
    for(int i=0;i<entries.length();i++){
      JSONObject item=entries.optJSONObject(i);
      if(item==null)continue;
      long at=item.optLong("at",0);
      if(at<=now+1500)continue;
      PendingIntent fire=alarm(context,item.optString("id"));
      if(precise&&show!=null){
        mgr.setAlarmClock(new AlarmManager.AlarmClockInfo(at,show),fire);
      }else{
        mgr.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,fire);
      }
    }
  }

  static synchronized void reschedule(Context context) {
    // Restoring after reboot, app upgrade, manual time change or permission grant.
    schedulePending(context,stored(context),prefs(context).getBoolean(PRECISE,false));
  }

  static synchronized JSONObject takeFired(Context context, String id) {
    JSONArray previous=stored(context);
    JSONArray rest=new JSONArray();
    JSONObject matching=null;
    for(int i=0;i<previous.length();i++){
      JSONObject item=previous.optJSONObject(i);
      if(item==null)continue;
      if(id.equals(item.optString("id")))matching=item;
      else rest.put(item);
    }
    long now=System.currentTimeMillis();
    if(matching==null)return null;
    long at=matching.optLong("at",0);
    // The receiver decides: within PLAY_WINDOW_MS → ezan; later (up to
    // NOTIFY_WINDOW_MS) → "vakti girdi" notification; older → stale, dropped.
    if(now < at-30_000 || now > at+NOTIFY_WINDOW_MS)return null;
    // Consume before playback, so receiver duplicates cannot replay the ezan.
    if(!prefs(context).edit().putString(EVENTS,rest.toString()).commit())
      return null;
    return matching;
  }

  static JSONArray stored(Context context) {
    try{
      return new JSONArray(prefs(context).getString(EVENTS,"[]"));
    }catch(JSONException ignored){return new JSONArray();}
  }

  static JSONObject status(Context context) throws JSONException{
    JSONObject result=new JSONObject();
    JSONArray entries=stored(context);
    result.put("supported",true);
    result.put("exactPermission",canExact(context));
    result.put("precise",prefs(context).getBoolean(PRECISE,false));
    result.put("scheduled",entries.length());
    long next=0;
    for(int i=0;i<entries.length();i++){
      JSONObject item=entries.optJSONObject(i);
      if(item==null)continue;
      long at=item.optLong("at",0);
      if(at>System.currentTimeMillis() && (next==0||at<next))next=at;
    }
    result.put("nextAt",next);
    return result;
  }

  static void scheduleTest(Context context){
    if(!canExact(context))throw new SecurityException("Kesin alarm izni gerekli");
    AlarmManager mgr=manager(context);
    if(mgr==null)throw new IllegalStateException("AlarmManager is unavailable");
    mgr.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,
        System.currentTimeMillis()+10_000,testAlarm(context));
  }
}
