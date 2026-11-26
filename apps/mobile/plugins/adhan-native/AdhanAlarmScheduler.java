package biz.camideyiz.app.adhan;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.os.SystemClock;
import android.provider.Settings;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Collections;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

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
  /** User opt-in: voice the ezan even on silent/vibrate/Do Not Disturb. */
  static final String PLAY_IN_SILENT = "playInSilent";
  /** What happened at the most recent ezan (or test): shown in the app so
   * "only a notification came" is never a mystery. */
  static final String LAST_OUTCOME = "lastOutcome";
  // 5 ezan × 10 verified days (core ANDROID_ALERT_MAX_DAYS) with headroom.
  private static final int MAX_EVENTS = 60;
  private static final long MAX_AHEAD = 11L * 24L * 60L * 60L * 1000L;
  /** Voice the ezan only near its published minute; later deliveries post
   * the "vakti girdi" notification instead of a surprising late ezan. */
  static final long PLAY_WINDOW_MS = 180_000L;
  /** Deliveries later than this are stale (device was off etc.): dropped. */
  static final long NOTIFY_WINDOW_MS = 2L * 60L * 60L * 1000L;
  /** An alarm-clock alarm is never this late. A planned ezan still unconsumed
   * this long after its minute, while the phone was running, was dropped by
   * the OS (Force Stop, ColorOS/MIUI background cleanup, no auto-launch after
   * a reboot): recorded as MISSED so the app can say exactly what to allow. */
  static final long MISSED_AFTER_MS = 10L * 60L * 1000L;
  static final String MISSED = "MISSED";
  private static final String TAG = "CamideyizAdhan";
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
    // Before the new plan overwrites the old one: was an ezan silently lost?
    detectMissed(app);
    String trimmed = raw == null ? "" : raw.trim();
    boolean precise = false;
    JSONArray input;
    if (trimmed.startsWith("{")) {
      JSONObject plan = new JSONObject(trimmed);
      precise = plan.optBoolean(PRECISE, false);
      // Playback policy only; it never needs the alarms re-armed, so it is
      // stored before the same-plan shortcut below.
      prefs(app).edit().putBoolean(PLAY_IN_SILENT, plan.optBoolean(PLAY_IN_SILENT, false)).apply();
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
      // A prayer that became imminent while JS was planning is NOT an invalid
      // plan: rejecting it would turn every ezan into a notification. Below,
      // an already-armed one keeps its alarm and a never-armed one is dropped.
      if (!id.matches("\\d{4}-\\d{2}-\\d{2}:(imsak|ogle|ikindi|aksam|yatsi):atTime:0") ||
          at < now - 60_000 || at > now + MAX_AHEAD ||
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
    JSONArray previous=stored(app);
    Set<String> keepArmed=new HashSet<>();
    JSONArray planned=new JSONArray();
    for (int i = 0; i < input.length(); i++) {
      JSONObject item=input.getJSONObject(i);
      long at=item.optLong("at",0);
      String id=item.optString("id");
      if (at>now+1500) planned.put(item);
      else if (find(previous,id,at)!=null) {
        // Already armed and due now: keep that alarm instead of cancelling it.
        planned.put(item);
        keepArmed.add(id);
      }
      // Otherwise it was never armed: not stored, so it can never look MISSED.
    }
    // The planner skips a prayer due within seconds; a re-plan at that moment
    // must not cancel the same district's ezan that is about to fire.
    String place=input.length()>0?input.getJSONObject(0).optString("place",""):null;
    for (int i = 0; place!=null && i < previous.length(); i++) {
      JSONObject old=previous.optJSONObject(i);
      if (old==null) continue;
      long at=old.optLong("at",0);
      String id=old.optString("id");
      if (at>now && at<=now+10_000L && place.equals(old.optString("place","")) &&
          find(input,id,-1)==null) {
        planned.put(old);
        keepArmed.add(id);
      }
    }
    clearPending(app,keepArmed);
    if (!local.edit().putString(EVENTS,planned.toString())
        .putBoolean(PRECISE,precise)
        .putLong("lastPlanWrittenAt",now).commit())
      throw new JSONException("Ezan planı kalıcı olarak kaydedilemedi");
    input=planned;
    int armed=schedulePending(app, input, precise);
    if (armed<0 && input.length()>0) throw new SecurityException("Kesin alarm izni verilmedi");
    lastPlanThisProcess=normalized;
    lastPlanAtThisProcess=now;
    return status(app);
  }

  /** The entry with this id (and, when at >= 0, this exact instant). */
  private static JSONObject find(JSONArray entries,String id,long at){
    for (int i = 0; i < entries.length(); i++) {
      JSONObject item=entries.optJSONObject(i);
      if (item!=null && id.equals(item.optString("id")) &&
          (at<0 || item.optLong("at",0)==at)) return item;
    }
    return null;
  }

  static synchronized void clear(Context context) {
    clearPending(context,Collections.<String>emptySet());
    prefs(context).edit().remove(EVENTS).commit();
    lastPlanThisProcess=null;
    lastPlanAtThisProcess=0;
    AlarmManager mgr=manager(context);
    if(mgr!=null)mgr.cancel(testAlarm(context));
  }

  private static void clearPending(Context context,Set<String> keep) {
    AlarmManager mgr=manager(context);
    if(mgr==null)return;
    JSONArray previous=stored(context);
    for(int i=0;i<previous.length();i++) {
      JSONObject item=previous.optJSONObject(i);
      if(item!=null&&!keep.contains(item.optString("id")))
        mgr.cancel(alarm(context,item.optString("id")));
    }
  }

  /**
   * The ezan is always armed with setAlarmClock: the OS never defers or
   * batches these (Doze and OEM battery savers included), and an exact alarm
   * is what lets the receiver start the playback service from the background
   * on Android 12+. A deferred setExactAndAllowWhileIdle alarm arrives after
   * the 3-minute play window on ColorOS and turns the ezan into a
   * notification, so it is only the fallback if no show intent exists.
   * "precise" (the notification precision switch) stays part of the plan
   * identity for upgrade compatibility.
   *
   * @return alarms armed, or -1 if Android refused exact alarms.
   */
  private static int schedulePending(Context context, JSONArray entries, boolean precise) {
    AlarmManager mgr=manager(context);
    if(mgr==null || !canExact(context))return -1;
    final long now=System.currentTimeMillis();
    PendingIntent show=AdhanNotifier.openApp(context,748034);
    int armed=0;
    for(int i=0;i<entries.length();i++){
      JSONObject item=entries.optJSONObject(i);
      if(item==null)continue;
      long at=item.optLong("at",0);
      if(at<=now+1500)continue;
      PendingIntent fire=alarm(context,item.optString("id"));
      try{
        if(show!=null){
          mgr.setAlarmClock(new AlarmManager.AlarmClockInfo(at,show),fire);
        }else{
          mgr.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,fire);
        }
        armed++;
      }catch(SecurityException error){
        // Exact access revoked between the check and the call: never crash
        // a boot receiver; the app re-arms (or falls back) on next sync.
        Log.w(TAG,"Exact alarm refused while arming the ezan",error);
        return -1;
      }
    }
    return armed;
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
    Context app=context.getApplicationContext();
    detectMissed(app);
    JSONObject result=new JSONObject();
    JSONArray entries=stored(app);
    result.put("supported",true);
    result.put("exactPermission",canExact(app));
    result.put("precise",prefs(app).getBoolean(PRECISE,false));
    result.put("scheduled",entries.length());
    long next=0;
    String nextLabel="";
    for(int i=0;i<entries.length();i++){
      JSONObject item=entries.optJSONObject(i);
      if(item==null)continue;
      long at=item.optLong("at",0);
      if(at>System.currentTimeMillis() && (next==0||at<next)){
        next=at;
        nextLabel=item.optString("label","");
      }
    }
    result.put("nextAt",next);
    result.put("nextLabel",nextLabel);
    result.put(PLAY_IN_SILENT,prefs(app).getBoolean(PLAY_IN_SILENT,false));
    result.put("batteryUnrestricted",batteryUnrestricted(app));
    // Live phone state, so the app can name what would block the ezan NOW.
    // The receiver applies the very same checks at prayer time.
    AudioManager audio=(AudioManager)app.getSystemService(Context.AUDIO_SERVICE);
    if(audio!=null){
      int ringer=audio.getRingerMode();
      result.put("ringer",ringer==AudioManager.RINGER_MODE_SILENT?"silent"
          :ringer==AudioManager.RINGER_MODE_VIBRATE?"vibrate":"normal");
      result.put("alarmVolume",audio.getStreamVolume(AudioManager.STREAM_ALARM));
      result.put("alarmVolumeMax",audio.getStreamMaxVolume(AudioManager.STREAM_ALARM));
    }
    result.put("interruption",interruption(app));
    result.put("notificationsEnabled",notificationsEnabled(app));
    result.put("backgroundManaged",backgroundManagedOem());
    result.put("playing",AdhanPlaybackService.isPlaying());
    String last=prefs(app).getString(LAST_OUTCOME,null);
    if(last!=null){
      try{result.put(LAST_OUTCOME,new JSONObject(last));}catch(JSONException ignored){}
    }
    return result;
  }

  /** "all" | "priority" | "alarms" | "none" | "unknown" (Do Not Disturb). */
  static String interruption(Context context){
    if(Build.VERSION.SDK_INT<Build.VERSION_CODES.M)return "unknown";
    NotificationManager manager=context.getSystemService(NotificationManager.class);
    if(manager==null)return "unknown";
    switch(manager.getCurrentInterruptionFilter()){
      case NotificationManager.INTERRUPTION_FILTER_ALL:return "all";
      case NotificationManager.INTERRUPTION_FILTER_PRIORITY:return "priority";
      case NotificationManager.INTERRUPTION_FILTER_ALARMS:return "alarms";
      case NotificationManager.INTERRUPTION_FILTER_NONE:return "none";
      default:return "unknown";
    }
  }

  static boolean notificationsEnabled(Context context){
    NotificationManager manager=(NotificationManager)
        context.getSystemService(Context.NOTIFICATION_SERVICE);
    return manager==null||manager.areNotificationsEnabled();
  }

  private static String maker(){
    return Build.MANUFACTURER==null?"":Build.MANUFACTURER.toLowerCase(Locale.ROOT);
  }

  /** OEMs whose battery manager stops background apps, and with them their
   * alarms, unless "background activity" / "auto launch" is allowed. */
  static boolean backgroundManagedOem(){
    String maker=maker();
    return maker.contains("oppo")||maker.contains("oneplus")||maker.contains("realme")||
        maker.contains("xiaomi")||maker.contains("redmi")||maker.contains("poco")||
        maker.contains("vivo")||maker.contains("huawei")||maker.contains("honor");
  }

  private static boolean oppoFamily(){
    String maker=maker();
    return maker.contains("oppo")||maker.contains("oneplus")||maker.contains("realme");
  }

  /**
   * Records MISSED for the latest planned ezan the OS never delivered while
   * the phone was running. A prayer that passed while the phone was off
   * (before this boot) is not the app's fault and is not reported. Only the
   * newest such prayer is recorded, once, and only if it is newer than the
   * last recorded outcome.
   */
  static synchronized void detectMissed(Context context){
    JSONArray entries=stored(context);
    if(entries.length()==0)return;
    long now=System.currentTimeMillis();
    long bootedAt=now-SystemClock.elapsedRealtime();
    JSONObject missed=null;
    for(int i=0;i<entries.length();i++){
      JSONObject item=entries.optJSONObject(i);
      if(item==null)continue;
      long at=item.optLong("at",0);
      if(at<=bootedAt+60_000L||at>now-MISSED_AFTER_MS||now-at>24L*60L*60L*1000L)continue;
      if(missed==null||at>missed.optLong("at",0))missed=item;
    }
    if(missed==null)return;
    long at=missed.optLong("at",0);
    long lastAt=0;
    String last=prefs(context).getString(LAST_OUTCOME,null);
    if(last!=null){
      try{lastAt=new JSONObject(last).optLong("at",0);}catch(JSONException ignored){}
    }
    if(at<=lastAt)return;
    Log.w(TAG,"Ezan alarm was dropped by the OS: "+missed.optString("id"));
    recordOutcome(context,missed.optString("label",""),MISSED,false,at);
  }

  static boolean batteryUnrestricted(Context context){
    if(Build.VERSION.SDK_INT<Build.VERSION_CODES.M)return true;
    PowerManager power=(PowerManager)context.getSystemService(Context.POWER_SERVICE);
    return power!=null&&power.isIgnoringBatteryOptimizations(context.getPackageName());
  }

  /** STARTED, COMPLETED, STOPPED, MISSED or the fallback reason, for the app UI. */
  static void recordOutcome(Context context,String label,String outcome,boolean test){
    recordOutcome(context,label,outcome,test,System.currentTimeMillis());
  }

  static void recordOutcome(Context context,String label,String outcome,boolean test,long at){
    try{
      JSONObject record=new JSONObject()
          .put("label",label==null?"":label)
          .put("outcome",outcome)
          .put("at",at)
          .put("test",test);
      prefs(context).edit().putString(LAST_OUTCOME,record.toString()).apply();
    }catch(JSONException ignored){}
  }

  /** The test travels the same AlarmManager API and receiver checks as a
   * real prayer, so a passing test means the real ezan will be voiced. */
  static void scheduleTest(Context context){
    if(!canExact(context))throw new SecurityException("Kesin alarm izni gerekli");
    AlarmManager mgr=manager(context);
    if(mgr==null)throw new IllegalStateException("AlarmManager is unavailable");
    long at=System.currentTimeMillis()+10_000;
    PendingIntent show=AdhanNotifier.openApp(context,748034);
    if(show!=null)mgr.setAlarmClock(new AlarmManager.AlarmClockInfo(at,show),testAlarm(context));
    else mgr.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,testAlarm(context));
  }

  /** App info page: on ColorOS/MIUI the battery entry there holds "allow
   * background activity", which keeps the alarm receiver from being frozen. */
  static void openAppSettings(Context context){
    Intent intent=new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
    intent.setData(Uri.parse("package:"+context.getPackageName()));
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    context.startActivity(intent);
  }

  private static boolean tryStart(Context context,Intent intent){
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    try{
      context.startActivity(intent);
      return true;
    }catch(Exception error){
      // ActivityNotFoundException / SecurityException on this OEM build.
      return false;
    }
  }

  /**
   * One tap from an ezan blocker row to the system screen that fixes it.
   * Every kind falls back to the app's own info page, which always exists.
   *   exact         Android 12+ "Alarms & reminders" for this app
   *   notifications this app's notification settings
   *   battery       app info: "App battery usage" (stock) / "Pil kullanımı"
   *                 (ColorOS, MIUI) holds "unrestricted / background activity"
   *   background    older ColorOS/OnePlus auto-launch list, else app info
   *                 (ColorOS 13+: App info → Pil kullanımı holds both
   *                 "background activity" and "auto launch")
   *   sound         sound settings (ringer, alarm volume)
   *   dnd           Do Not Disturb settings
   */
  static void openSettings(Context context,String kind){
    String pkg=context.getPackageName();
    boolean opened=false;
    if("exact".equals(kind)){
      if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.S){
        opened=tryStart(context,new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
            .setData(Uri.parse("package:"+pkg)));
      }
    }else if("notifications".equals(kind)){
      if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.O){
        opened=tryStart(context,new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
            .putExtra(Settings.EXTRA_APP_PACKAGE,pkg));
      }
    }else if("background".equals(kind)){
      if(oppoFamily()&&Build.VERSION.SDK_INT<Build.VERSION_CODES.TIRAMISU){
        String[][] targets={
          {"com.coloros.safecenter","com.coloros.safecenter.startupapp.StartupAppListActivity"},
          {"com.coloros.safecenter","com.coloros.safecenter.permission.startup.StartupAppListActivity"},
          {"com.oplus.safecenter","com.oplus.safecenter.startupapp.StartupAppListActivity"},
          {"com.oppo.safe","com.oppo.safe.permission.startup.StartupAppListActivity"},
          {"com.oneplus.security","com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity"},
        };
        for(String[] target:targets){
          if(tryStart(context,new Intent().setComponent(new ComponentName(target[0],target[1])))){
            opened=true;
            break;
          }
        }
      }
    }else if("sound".equals(kind)){
      opened=tryStart(context,new Intent(Settings.ACTION_SOUND_SETTINGS));
    }else if("dnd".equals(kind)){
      if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.O){
        opened=tryStart(context,new Intent(Settings.ACTION_ZEN_MODE_PRIORITY_SETTINGS));
      }
      if(!opened)opened=tryStart(context,new Intent(Settings.ACTION_SOUND_SETTINGS));
    }
    if(!opened)openAppSettings(context);
  }

  /** "Alarm sesini aç": raises a muted alarm volume to a comfortable level and
   * shows the system volume panel so the user can fine-tune it. */
  static int raiseAlarmVolume(Context context){
    AudioManager audio=(AudioManager)context.getSystemService(Context.AUDIO_SERVICE);
    if(audio==null)return -1;
    int max=audio.getStreamMaxVolume(AudioManager.STREAM_ALARM);
    int current=audio.getStreamVolume(AudioManager.STREAM_ALARM);
    int target=Math.max(current,Math.max(1,Math.round(max*0.6f)));
    try{
      audio.setStreamVolume(AudioManager.STREAM_ALARM,target,AudioManager.FLAG_SHOW_UI);
    }catch(SecurityException error){
      // Some Do Not Disturb policies forbid volume changes: open sound settings.
      openSettings(context,"sound");
      return current;
    }
    return audio.getStreamVolume(AudioManager.STREAM_ALARM);
  }
}
