package biz.camideyiz.app.widget;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;
import android.util.TypedValue;
import android.widget.RemoteViews;

import biz.camideyiz.app.R;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Android launcher widgets — native RemoteViews, not the isolated Expo
 * widget JS engine. Both provider component names are retained during app
 * upgrades, so already-pinned widgets keep their appWidget IDs.
 *
 * The only source of times is the already validated published prayer
 * calendar supplied by the React app. Native code does NOT calculate
 * astronomical times or fetch potentially mismatched district data.
 *
 * All user taps use a real launcher PendingIntent, not an inert label.
 * No exact-alarm, location, or notification permission is required.
 */
public final class WidgetBoundaryScheduler {
  private static final String TAG = "CamideyizWidget";
  private static final String PREFS = "camideyiz.widget.boundaries.v1";
  private static final String CALENDAR = "timeline";
  private static final String ACTION = "biz.camideyiz.app.WIDGET_BOUNDARY";
  private static final String[] NAMES = {"NextPrayerWidget", "PrayerDayWidget"};
  // Published days may remain valid offline up to their 16-day coverage.
  // Do not erase a still-valid published timetable after only 72 hours.
  private static final long MAX_AGE = 16L * 24 * 60 * 60 * 1000;
  private static final long MAX_FUTURE = 17L * 24 * 60 * 60 * 1000;

  private WidgetBoundaryScheduler() {}

  private static SharedPreferences prefs(Context context) {
    return context.getApplicationContext()
        .getSharedPreferences(PREFS, Context.MODE_PRIVATE);
  }

  private static JSONObject parseAndValidate(String raw, long now) throws JSONException {
    JSONObject root = new JSONObject(raw);
    if (root.optInt("version") != 1 || root.optInt("cityId") <= 0 ||
        root.optString("city").trim().isEmpty())
      throw new JSONException("invalid district identity");
    long generatedAt = root.optLong("generatedAt", -1);
    long sourceAt = root.optLong("sourceAt", -1);
    if (generatedAt < now - 60_000 || generatedAt > now + 60_000 ||
        sourceAt > now + 60_000 || sourceAt <= 0 ||
        now - sourceAt > MAX_AGE)
      throw new JSONException("outdated widget source or sync request");
    JSONArray entries = root.optJSONArray("entries");
    if (entries == null || entries.length() < 1 || entries.length() > 110)
      throw new JSONException("invalid prayer boundary count");
    long last = -1;
    for (int i = 0; i < entries.length(); i++) {
      JSONObject entry = entries.getJSONObject(i);
      long at = entry.getLong("at");
      if (at <= last || at > now + MAX_FUTURE ||
          (i == 0 && (at > now + 60_000 || at < now - 60_000)))
        throw new JSONException("non-increasing or out-of-range boundary");
      last = at;
      JSONObject props = entry.getJSONObject("props");
      if (!props.optString("city").equals(root.getString("city")) ||
          !props.has("ready") || !props.has("nextName") ||
          !props.has("nextTime") || !props.has("nextAt") ||
          !props.has("dateISO") || !props.has("times"))
        throw new JSONException("incomplete widget props");
      if (props.getBoolean("ready")) {
        if (props.getJSONArray("times").length() != 6 ||
            props.optString("nextName").isEmpty() ||
            !props.optString("nextTime").matches("\\d{2}:\\d{2}") ||
            props.optLong("nextAt") <= at)
          throw new JSONException("invalid published prayer times");
      }
    }
    return root;
  }

  /**
   * Changes to district identity are a separate explicit operation.
   * A source timeout or a pending JS fetch must NEVER erase an already
   * confirmed timetable for the same district.
   */
  public static synchronized JSONObject selectDistrict(Context context,int cityId)
      throws JSONException {
    if(cityId<0||cityId>1_000_000)throw new JSONException("invalid selected district");
    Context app=context.getApplicationContext();
    SharedPreferences local=prefs(app);
    int existing=local.getInt("activeCityId",0);
    int calendarCity=0;
    try {
      String raw=local.getString(CALENDAR,null);
      if(raw!=null)calendarCity=new JSONObject(raw).optInt("cityId",0);
    }catch(JSONException ignored){}
    if(existing!=cityId || (calendarCity!=0&&calendarCity!=cityId)){
      SharedPreferences.Editor editor=local.edit().putInt("activeCityId",cityId)
          .putString("lastTransferStage","awaiting-published-data")
          .putString("lastTransferDetail","İlçe seçildi; doğrulanmış takvim bekleniyor.")
          .putString("lastTransferError","");
      if(calendarCity!=0&&calendarCity!=cityId || cityId==0)editor.remove(CALENDAR);
      if(!editor.commit())throw new JSONException("cannot persist selected district");
      refresh(app,"district:selected");
    }else if(existing==0 && cityId>0){
      if(!local.edit().putInt("activeCityId",cityId).commit())
        throw new JSONException("cannot persist selected district");
    }
    return status(app);
  }

  /** Durable diagnostic, not overwritten by routine launcher refresh calls. */
  public static synchronized JSONObject transferStage(Context context,int cityId,
      String stage,String detail) throws JSONException{
    if(cityId<0||cityId>1_000_000||
       !("waiting".equals(stage)||"failed".equals(stage)))
      throw new JSONException("invalid transfer diagnostic");
    Context app=context.getApplicationContext();
    SharedPreferences local=prefs(app);
    int selected=local.getInt("activeCityId",0);
    if(cityId!=selected)return status(app); // outdated network request
    String safe=(detail==null?"":detail).replace('\n',' ').replace('\r',' ');
    if(safe.length()>280)safe=safe.substring(0,280);
    // Preserve a previously failed native transfer across subsequent
    // "waiting for source" calls. Only a successful publication or an
    // explicit district change clears the error.
    String previousError=local.getString("lastTransferError","");
    if(!local.edit().putLong("lastTransferAttemptAt",System.currentTimeMillis())
        .putString("lastTransferStage",stage)
        .putString("lastTransferDetail",safe)
        .putString("lastTransferError","failed".equals(stage)?safe:previousError)
        .commit())throw new JSONException("cannot persist transfer diagnostic");
    return status(app);
  }

  public static synchronized JSONObject publish(Context context, String raw)
      throws JSONException {
    Context app = context.getApplicationContext();
    long now = System.currentTimeMillis();
    if(raw==null||raw.isEmpty())
      throw new JSONException("empty calendar rejected: use selectDistrict instead");
    JSONObject incoming=parseAndValidate(raw,now);
    SharedPreferences local=prefs(app);
    int active=local.getInt("activeCityId",0);
    int incomingCity=incoming.getInt("cityId");
    if(active!=0&&active!=incomingCity)
      throw new JSONException("calendar district differs from selected district");
    if(!local.edit().putInt("activeCityId",incomingCity)
        .putLong("lastSyncAt",now)
        .putLong("lastTransferAttemptAt",now)
        .putString("lastTransferStage","native-committed")
        .putString("lastTransferDetail","Doğrulanmış namaz vakitleri kaydedildi.")
        .putString("lastTransferError","")
        .putString(CALENDAR,incoming.toString())
        .commit())
      throw new JSONException("cannot persist calendar");
    refresh(app,"calendar:published");
    JSONObject result=status(app);
    if(!result.optBoolean("lastReady",false)||!result.optBoolean("hasTimeline",false)
        ||!result.optString("lastError","").isEmpty())
      throw new JSONException("native calendar persisted but launcher update failed");
    return result;
  }

  /**
   * Called by app foreground sync, system widget installation, reboot and
   * an inexact AlarmManager prayer boundary. Time is read at DELIVERY, not
   * the originally expected instant, so a delayed alarm catches up at once.
   */
  public static synchronized void refresh(Context context) {
    refresh(context,"native:refresh");
  }

  /** Safe recovery is idempotent and reads only the persisted verified timeline.
   * Reasons are recorded for actionable support diagnostics, not pixel claims. */
  public static synchronized void refresh(Context context,String reason) {
    Context app=context.getApplicationContext();
    SharedPreferences local=prefs(app);
    long now=System.currentTimeMillis();
    long nextBoundary=0;
    int installed=0;
    local.edit().putLong("lastAttemptAt",now)
        .putString("lastRefreshReason",reason).apply();
    try {
      JSONObject selection=null;
      String raw=local.getString(CALENDAR,null);
      long calendarEndsAt=0;
      long sourceAt=0;
      if(raw!=null){
        JSONObject root=new JSONObject(raw);
        long generatedAt=root.getLong("generatedAt");
        sourceAt=root.getLong("sourceAt");
        if(generatedAt<=now+60_000 && sourceAt<=now+60_000 &&
            sourceAt>0 && now-sourceAt<=MAX_AGE){
          JSONArray entries=root.getJSONArray("entries");
          calendarEndsAt=entries.getJSONObject(entries.length()-1).getLong("at");
          for(int i=0;i<entries.length();i++){
            JSONObject item=entries.getJSONObject(i);
            long at=item.getLong("at");
            if(at<=now) selection=item.getJSONObject("props");
            else { nextBoundary=at; break; }
          }
          long expiresAt=Math.min(sourceAt+MAX_AGE,calendarEndsAt);
          if(nextBoundary==0 || nextBoundary>expiresAt)
            nextBoundary=expiresAt>now?expiresAt:0;
        }
      }
      if(selection==null)selection=emptyProps(now);
      selection.put("updatedAt",now);
      selection.put("updatedClock",clock(now));
      selection.put("nativeAppliedAt",now);

      // Commit native data BEFORE a launcher update; if writing fails,
      // report the error rather than treating update as successful.
      if(!local.edit().putLong("lastAppliedAt",now)
          .putLong("calendarEndsAt",calendarEndsAt)
          .putLong("calendarSourceAt",sourceAt)
          .putString("lastProps",selection.toString())
          .putString("lastNextName",selection.optString("nextName",""))
          .putString("lastNextTime",selection.optString("nextTime",""))
          .putString("lastCity",selection.optString("city",""))
          .putString("lastDateISO",selection.optString("dateISO",""))
          .putBoolean("lastReady",selection.optBoolean("ready",false))
          .remove("lastError").commit())
        throw new IllegalStateException("native snapshot commit failed");

      installed=renderWidgets(app,selection);
      local.edit().putInt("lastInstanceCount",installed)
          .putLong("lastHostDispatchAt",installed>0?now:0).apply();
    }catch(Exception error){
      Log.e(TAG,"Native launcher widget update failed",error);
      local.edit().putString("lastError",
          error.getClass().getSimpleName()+": "+error.getMessage()).apply();
      nextBoundary=0;
    }
    // No pinned widgets: do not keep waking the process for prayer boundaries.
    // AppWidgetProvider.onUpdate() will restart the alarm when a widget is added.
    scheduleNext(app,installed>0?nextBoundary:0,now);
  }

  private static JSONObject emptyProps(long now) throws JSONException {
    JSONObject props=new JSONObject();
    props.put("ready",false);
    props.put("city","Konum seçilmedi");
    props.put("dateISO","");
    props.put("nextName","Takvimi aç");
    props.put("nextTime","");
    props.put("nextAt",0);
    props.put("updatedAt",now);
    props.put("remainingMinutes",0);
    props.put("updatedClock",clock(now));
    props.put("times",new JSONArray());
    return props;
  }

  private static String clock(long now) {
    SimpleDateFormat fmt=new SimpleDateFormat("HH:mm",Locale.forLanguageTag("tr-TR"));
    fmt.setTimeZone(TimeZone.getTimeZone("Europe/Istanbul"));
    return fmt.format(new Date(now));
  }

  private static ComponentName component(Context context,String name){
    // Keep the old Expo provider FQCN to retain the user's pinned instances.
    return new ComponentName(context.getPackageName(),
        context.getPackageName()+"."+name+"Provider");
  }

  private static int installedCount(Context context,String name){
    try{
      return AppWidgetManager.getInstance(context)
          .getAppWidgetIds(component(context,name)).length;
    }catch(Exception error){
      Log.w(TAG,"Cannot inspect pinned widget IDs",error);
      return 0;
    }
  }

  /** Use an actual PendingIntent to MainActivity. A text label in a widget
   * cannot launch the app by itself; the entire native card is tappable. */
  private static PendingIntent launchAction(Context context,int requestCode) {
    Intent launch=context.getPackageManager()
        .getLaunchIntentForPackage(context.getPackageName());
    if(launch==null) {
      launch=new Intent(Intent.ACTION_MAIN);
      launch.addCategory(Intent.CATEGORY_LAUNCHER);
      launch.setPackage(context.getPackageName());
    }
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
        |Intent.FLAG_ACTIVITY_CLEAR_TOP
        |Intent.FLAG_ACTIVITY_SINGLE_TOP);
    return PendingIntent.getActivity(context,requestCode,launch,
        PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  }

  private static int renderWidgets(Context context,JSONObject props)
      throws JSONException {
    AppWidgetManager manager=AppWidgetManager.getInstance(context);
    boolean ready=props.optBoolean("ready",false);
    String city=props.optString("city","Konum seçilmedi");
    String next=props.optString("nextName","");
    String time=props.optString("nextTime","");
    int count=0;

    int[] small=manager.getAppWidgetIds(component(context,NAMES[0]));
    if(small.length>0){
      RemoteViews card=new RemoteViews(context.getPackageName(),R.layout.widget_next_prayer);
      card.setTextViewText(R.id.widget_city,ready?city:"Takvim henüz yüklenmedi");
      card.setTextViewText(R.id.widget_next_label,ready?"Sıradaki vakit · "+next
          :"Uygulama takvimini aç");
      card.setTextViewText(R.id.widget_next_time,ready?time:"Vakitleri yükle");
      card.setTextViewTextSize(R.id.widget_next_time,TypedValue.COMPLEX_UNIT_SP,
          ready?28:17);
      card.setTextViewText(R.id.widget_hint,ready
          ?"Güncelleme "+props.optString("updatedClock","")
          :"Takvimi açmak için dokun");
      card.setOnClickPendingIntent(R.id.widget_root,launchAction(context,41018));
      manager.updateAppWidget(small,card);
      count+=small.length;
    }

    int[] day=manager.getAppWidgetIds(component(context,NAMES[1]));
    if(day.length>0){
      RemoteViews card=new RemoteViews(context.getPackageName(),R.layout.widget_prayer_day);
      card.setTextViewText(R.id.widget_day_city,
          ready?city+" · Bugünün vakitleri":"Takvim henüz yüklenmedi");
      JSONArray times=ready?props.getJSONArray("times"):new JSONArray();
      int[] cells={
        R.id.widget_day_time_0,R.id.widget_day_time_1,R.id.widget_day_time_2,
        R.id.widget_day_time_3,R.id.widget_day_time_4,R.id.widget_day_time_5
      };
      for(int i=0;i<cells.length;i++){
        if(i<times.length()){
          JSONObject row=times.getJSONObject(i);
          card.setTextViewText(cells[i],
              row.optString("label","")+"  "+row.optString("time",""));
        }else{
          card.setTextViewText(cells[i],i==0?"Vakitleri yükle":"—");
        }
      }
      card.setTextViewText(R.id.widget_day_footer,
          ready?"Sıradaki · "+next+" "+time
            :"Uygulamayı açmak için widget'a dokun");
      card.setOnClickPendingIntent(R.id.widget_day_root,launchAction(context,41019));
      manager.updateAppWidget(day,card);
      count+=day.length;
    }
    return count;
  }

  private static PendingIntent alarmIntent(Context context){
    Intent intent=new Intent(context,WidgetBoundaryReceiver.class).setAction(ACTION);
    return PendingIntent.getBroadcast(context,41017,intent,
        PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  }

  private static void scheduleNext(Context context,long next,long now){
    SharedPreferences local=prefs(context);
    try{
      AlarmManager manager=(AlarmManager)context.getSystemService(Context.ALARM_SERVICE);
      if(manager==null)throw new IllegalStateException("AlarmManager absent");
      PendingIntent intent=alarmIntent(context);
      manager.cancel(intent);
      if(next<=now){
        local.edit().putLong("nextAlarmAt",0).apply();
        return;
      }
      // Android Doze may delay inexact alarms. No exact-alarm permission.
      manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,next+1200,intent);
      local.edit().putLong("nextAlarmAt",next).apply();
    }catch(Exception error){
      local.edit().putLong("nextAlarmAt",0)
          .putString("lastError","alarm: "+error.getMessage()).apply();
    }
  }

  public static JSONObject status(Context context) throws JSONException{
    SharedPreferences local=prefs(context);
    JSONObject result=new JSONObject();
    result.put("supported",true);
    result.put("installedNext",installedCount(context,NAMES[0]));
    result.put("installedDay",installedCount(context,NAMES[1]));
    long last=local.getLong("lastAppliedAt",0);
    result.put("lastAppliedAt",last);
    result.put("nextAlarmAt",local.getLong("nextAlarmAt",0));
    result.put("lastAttemptAt",local.getLong("lastAttemptAt",0));
    result.put("lastRefreshReason",local.getString("lastRefreshReason",""));
    result.put("lastHostDispatchAt",local.getLong("lastHostDispatchAt",0));
    result.put("lastInstanceCount",local.getInt("lastInstanceCount",0));
    result.put("calendarSourceAt",local.getLong("calendarSourceAt",0));
    result.put("calendarEndsAt",local.getLong("calendarEndsAt",0));
    result.put("lastSyncAt",local.getLong("lastSyncAt",0));
    result.put("lastError",local.getString("lastError",""));
    result.put("lastNextName",local.getString("lastNextName",""));
    result.put("lastNextTime",local.getString("lastNextTime",""));
    result.put("lastCity",local.getString("lastCity",""));
    result.put("lastDateISO",local.getString("lastDateISO",""));
    result.put("lastReady",local.getBoolean("lastReady",false));
    boolean persisted=false;
    try{
      JSONObject payload=new JSONObject(local.getString("lastProps",""));
      persisted=last>0 && payload.optLong("nativeAppliedAt")==last &&
          payload.optBoolean("ready")==local.getBoolean("lastReady",false);
    }catch(JSONException ignored){}
    result.put("persisted",persisted);
    boolean hasTimeline=local.contains(CALENDAR);
    result.put("hasTimeline",hasTimeline);
    int nativeCityId=0;
    if(hasTimeline) {
      try {
        nativeCityId=new JSONObject(local.getString(CALENDAR,"")).optInt("cityId",0);
      }catch(JSONException ignored){}
    }
    result.put("nativeCityId",nativeCityId);
    result.put("activeCityId",local.getInt("activeCityId",0));
    result.put("lastTransferAttemptAt",local.getLong("lastTransferAttemptAt",0));
    result.put("lastTransferStage",local.getString("lastTransferStage","never-attempted"));
    result.put("lastTransferDetail",local.getString("lastTransferDetail",""));
    result.put("lastTransferError",local.getString("lastTransferError",""));
    long sourceAge=local.getLong("calendarSourceAt",0);
    boolean ready=local.getBoolean("lastReady",false);
    String error=local.getString("lastError","");
    int count=installedCount(context,NAMES[0])+installedCount(context,NAMES[1]);
    String stage=local.getString("lastTransferStage","never-attempted");
    String transferError=local.getString("lastTransferError","");
    String state=!error.isEmpty()||!transferError.isEmpty()||
        "failed".equals(stage)?"native-error":
        count==0?"not-installed":!hasTimeline?"no-published-calendar":
        !ready?"not-ready":"native-dispatched";
    result.put("state",state);
    result.put("sourceAgeHours",sourceAge>0?Math.max(0,
        (System.currentTimeMillis()-sourceAge)/(60L*60L*1000L)):-1);
    result.put("osRecoveryMinutes",30);
    // Android Launcher is outside this process: no pixel acknowledgment.
    result.put("launcherConfirmed",false);
    return result;
  }
}
