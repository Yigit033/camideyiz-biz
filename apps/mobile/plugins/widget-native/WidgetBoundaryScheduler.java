package biz.camideyiz.app.widget;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.os.Build;
import android.os.SystemClock;
import android.util.Log;
import android.graphics.Color;
import android.widget.RemoteViews;
import android.view.View;

import biz.camideyiz.app.R;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Arrays;
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
  private static final String[] NAMES = {
    "NextPrayerWidget","PrayerDayWidget","CompactPrayerWidget",
    "PrayerFocusWidget","PrayerStripWidget",
    "MiniPrayerRingWidget","PremiumPrayerRingWidget","SlimPrayerWidget"
  };
  // Published days may remain valid offline up to their 16-day coverage.
  // Do not erase a still-valid published timetable after only 72 hours.
  private static final long MAX_AGE = 16L * 24 * 60 * 60 * 1000;
  private static final long MAX_FUTURE = 17L * 24 * 60 * 60 * 1000;

  // Process-local measurements are captured on Android's monotonic clock.
  // A physical device is still required to establish actual frame/jank costs.
  private static volatile long lastRefreshMs=0;
  private static volatile long lastRenderMs=0;
  private static volatile long lastCommitMs=0;
  private static volatile long lastAlarmMs=0;
  private static volatile long skippedUnchangedRenders=0;
  private static volatile long renderedBatches=0;
  // AlarmManager state is not durable across force-stop or device reboot.
  // First widget engine operation in each process must explicitly rearm it.
  private static boolean alarmRearmRequiredThisProcess=true;

  private WidgetBoundaryScheduler() {}

  private static SharedPreferences prefs(Context context) {
    return context.getApplicationContext()
        .getSharedPreferences(PREFS, Context.MODE_PRIVATE);
  }

  /**
   * Visual mode belongs to the user's app preference. Keep a tiny native copy
   * so Android can render a consistent theme without waking React.
   */
  public static synchronized boolean setAppearance(
      Context context,String mode,String resolved){
    if(!("system".equals(mode)||"light".equals(mode)||"dark".equals(mode))||
       !("light".equals(resolved)||"dark".equals(resolved)))
      throw new IllegalArgumentException("Unsupported widget theme");
    SharedPreferences local=prefs(context);
    if(mode.equals(local.getString("appearance","system")) &&
        resolved.equals(local.getString("resolvedAppearance","unknown")))return false;
    local.edit().putString("appearance",mode)
        .putString("resolvedAppearance",resolved).apply();
    return true;
  }

  private static boolean lightTheme(Context context){
    String mode=prefs(context).getString("appearance","system");
    if("light".equals(mode))return true;
    if("dark".equals(mode))return false;
    return (context.getResources().getConfiguration().uiMode &
        Configuration.UI_MODE_NIGHT_MASK)!=Configuration.UI_MODE_NIGHT_YES;
  }

  /**
   * A native Chronometer counts down in the LAUNCHER without per-second
   * JS/network/WorkManager wakeups. Use elapsedRealtime, not wall-clock time.
   * The next boundary alarm refreshes the snapshot; Doze may delay rollover.
   */
  private static void setCountdown(RemoteViews card,int viewId,long nextAt,long now){
    if(nextAt<=now){
      card.setChronometer(viewId,SystemClock.elapsedRealtime(),null,false);
      card.setTextViewText(viewId,"—");
      return;
    }
    long remaining=nextAt-now;
    if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.N){
      card.setChronometer(viewId,SystemClock.elapsedRealtime()+remaining,null,true);
      card.setChronometerCountDown(viewId,true);
    }else{
      card.setChronometer(viewId,SystemClock.elapsedRealtime(),null,false);
      card.setTextViewText(viewId,((remaining+59_999)/60_000)+" dk");
    }
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
    final long started=SystemClock.elapsedRealtime();
    Context app=context.getApplicationContext();
    SharedPreferences local=prefs(app);
    long now=System.currentTimeMillis();
    long nextBoundary=0;
    int installed=0;
    lastRenderMs=0;
    lastCommitMs=0;
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
            if(at<=now)selection=item.getJSONObject("props");
            else {nextBoundary=at;break;}
          }
          long expiresAt=Math.min(sourceAt+MAX_AGE,calendarEndsAt);
          if(nextBoundary==0||nextBoundary>expiresAt)
            nextBoundary=expiresAt>now?expiresAt:0;
        }
      }
      if(selection==null)selection=emptyProps(now);
      selection.put("updatedAt",now);
      selection.put("updatedClock",clock(now));
      selection.put("nativeAppliedAt",now);
      WidgetInventory inventory=inspectWidgetInventory(app,selection);
      installed=inventory.count;
      boolean force=forceFullRender(reason);
      boolean unchanged=!force&&local.getLong("lastAppliedAt",0)>0&&
          local.getString("lastError","").isEmpty()&&
          inventory.signature.equals(local.getString("lastRenderSignature",""));
      if(unchanged){
        // Chronometer already ticks inside the launcher. No duplicate bitmap,
        // RemoteViews IPC, synchronous commit or JS wakeup is necessary.
        skippedUnchangedRenders++;
        local.edit().putLong("calendarEndsAt",calendarEndsAt)
            .putLong("calendarSourceAt",sourceAt).apply();
      }else{
        long committedAt=SystemClock.elapsedRealtime();
        // Preserve old semantics: a successful native publish acknowledges the
        // persisted data only after a successful full host dispatch.
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
        lastCommitMs=SystemClock.elapsedRealtime()-committedAt;
        long renderAt=SystemClock.elapsedRealtime();
        installed=renderWidgets(app,selection,inventory.ids);
        lastRenderMs=SystemClock.elapsedRealtime()-renderAt;
        renderedBatches++;
        local.edit().putString("lastRenderSignature",inventory.signature)
            .putInt("lastInstanceCount",installed)
            .putLong("lastHostDispatchAt",installed>0?now:0).apply();
      }
    }catch(Exception error){
      Log.e(TAG,"Native launcher widget update failed",error);
      local.edit().putString("lastError",
          error.getClass().getSimpleName()+": "+error.getMessage()).apply();
      nextBoundary=0;
    }
    // No pinned widgets: no alarm. A reboot/time change MUST rearm alarms.
    long alarmAt=SystemClock.elapsedRealtime();
    scheduleNext(app,installed>0?nextBoundary:0,now,forceAlarmRearm(reason));
    lastAlarmMs=SystemClock.elapsedRealtime()-alarmAt;
    lastRefreshMs=SystemClock.elapsedRealtime()-started;
    if(lastRefreshMs>1500)
      Log.w(TAG,"Slow widget refresh "+lastRefreshMs+"ms, reason="+reason+
          ", commit="+lastCommitMs+", render="+lastRenderMs+", alarm="+lastAlarmMs);
  }

  private static boolean forceAlarmRearm(String reason){
    return reason.contains("BOOT_COMPLETED")||reason.contains("TIME_SET")||
        reason.contains("TIMEZONE_CHANGED")||reason.contains("MY_PACKAGE_REPLACED");
  }

  private static boolean forceFullRender(String reason){
    return forceAlarmRearm(reason)||reason.startsWith("manual:")||
        reason.startsWith("theme:")||reason.startsWith("launcher:update:");
  }

  private static final class WidgetInventory{
    final int[][] ids;
    final int count;
    final String signature;
    WidgetInventory(int[][] ids,int count,String signature){
      this.ids=ids;this.count=count;this.signature=signature;
    }
  }

  /** Only eight binder inventory reads per refresh, including a widget-ID
   * fingerprint: replacing one 1×1 instance without changing count still
   * triggers its initial render.
   */
  private static WidgetInventory inspectWidgetInventory(
      Context context,JSONObject props){
    AppWidgetManager manager=AppWidgetManager.getInstance(context);
    int[][] ids={
      manager.getAppWidgetIds(component(context,NAMES[0])),
      manager.getAppWidgetIds(component(context,NAMES[1])),
      manager.getAppWidgetIds(component(context,NAMES[2])),
      manager.getAppWidgetIds(component(context,NAMES[3])),
      manager.getAppWidgetIds(component(context,NAMES[4])),
      manager.getAppWidgetIds(component(context,NAMES[5])),
      manager.getAppWidgetIds(component(context,NAMES[6])),
      manager.getAppWidgetIds(component(context,NAMES[7]))
    };
    StringBuilder key=new StringBuilder(600);
    key.append(prefs(context).getInt("activeCityId",0)).append('|')
      .append(lightTheme(context)).append('|')
      .append(props.optBoolean("ready",false)).append('|')
      .append(props.optString("city","")).append('|')
      .append(props.optString("dateISO","")).append('|')
      .append(props.optString("nextName","")).append('|')
      .append(props.optString("nextTime","")).append('|')
      .append(props.optLong("nextAt",0)).append('|')
      .append(props.optJSONArray("times")==null?"[]":props.optJSONArray("times").toString());
    int count=0;
    for(int[] category:ids){
      count+=category.length;
      int[] sorted=category.clone();
      Arrays.sort(sorted);
      key.append('|').append(Arrays.toString(sorted));
    }
    return new WidgetInventory(ids,count,key.toString());
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

  private static String isoDate(long timeMs) {
    SimpleDateFormat fmt=new SimpleDateFormat("yyyy-MM-dd",Locale.US);
    fmt.setTimeZone(TimeZone.getTimeZone("Europe/Istanbul"));
    return fmt.format(new Date(timeMs));
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

  private static int renderWidgets(Context context,JSONObject props,int[][] widgetIds)
      throws JSONException {
    AppWidgetManager manager=AppWidgetManager.getInstance(context);
    boolean ready=props.optBoolean("ready",false);
    String city=props.optString("city","Konum seçilmedi");
    String next=props.optString("nextName","");
    String time=props.optString("nextTime","");
    long nextAt=ready?props.optLong("nextAt",0):0;
    // After Yatsı, the next İmsak belongs to TOMORROW. Never highlight
    // today's already-passed İmsak in the six-row/daily strip layouts.
    boolean nextInCurrentDay=ready&&
        props.optString("dateISO","").equals(isoDate(nextAt));
    long now=System.currentTimeMillis();
    boolean light=lightTheme(context);
    int count=0;

    // 2×2: published prayer clock and a native, launcher-driven countdown.
    int[] small=widgetIds[0];
    if(small.length>0){
      RemoteViews card=new RemoteViews(context.getPackageName(),
          light?R.layout.widget_next_prayer_light:R.layout.widget_next_prayer);
      card.setTextViewText(R.id.widget_city,ready?city:"Takvim bekleniyor");
      card.setTextViewText(R.id.widget_next_label,ready?"SIRADAKİ VAKİT":"TAKVİM BEKLENİYOR");
      card.setTextViewText(R.id.widget_next_name,ready?next:"—");
      card.setTextViewText(R.id.widget_next_time,ready?time:"--:--");
      setCountdown(card,R.id.widget_next_countdown,nextAt,now);
      card.setViewVisibility(R.id.widget_next_countdown_row,ready?View.VISIBLE:View.GONE);
      card.setOnClickPendingIntent(R.id.widget_root,launchAction(context,41018));
      manager.updateAppWidget(small,card);
      count+=small.length;
    }

    // 4×2: six PUBLISHED hours, highlight the actual upcoming prayer.
    int[] day=widgetIds[1];
    JSONArray times=ready?props.getJSONArray("times"):new JSONArray();
    if(day.length>0){
      RemoteViews card=new RemoteViews(context.getPackageName(),
          light?R.layout.widget_prayer_day_light:R.layout.widget_prayer_day);
      card.setTextViewText(R.id.widget_day_city,ready?city:"Takvim bekleniyor");
      int[] rows={R.id.widget_day_row_0,R.id.widget_day_row_1,
          R.id.widget_day_row_2,R.id.widget_day_row_3,
          R.id.widget_day_row_4,R.id.widget_day_row_5};
      int[] icons={R.id.widget_day_icon_0,R.id.widget_day_icon_1,
          R.id.widget_day_icon_2,R.id.widget_day_icon_3,
          R.id.widget_day_icon_4,R.id.widget_day_icon_5};
      int[] labels={R.id.widget_day_label_0,R.id.widget_day_label_1,
          R.id.widget_day_label_2,R.id.widget_day_label_3,
          R.id.widget_day_label_4,R.id.widget_day_label_5};
      int[] clocks={R.id.widget_day_time_0,R.id.widget_day_time_1,
          R.id.widget_day_time_2,R.id.widget_day_time_3,
          R.id.widget_day_time_4,R.id.widget_day_time_5};
      String[] symbols={"◒","☀","☼","☀","◓","☾"};
      int normal=Color.parseColor(light?"#123D34":"#F8F4E9");
      int highlight=Color.parseColor(light?"#976B2F":"#F0CB8B");
      for(int i=0;i<6;i++){
        JSONObject value=i<times.length()?times.getJSONObject(i):null;
        String label=value==null?"—":value.optString("label","—");
        String clock=value==null?"--:--":value.optString("time","--:--");
        boolean selected=nextInCurrentDay && label.equals(next);
        card.setTextViewText(icons[i],symbols[i]);
        card.setTextViewText(labels[i],label);
        card.setTextViewText(clocks[i],clock);
        card.setTextColor(labels[i],selected?highlight:normal);
        card.setTextColor(clocks[i],selected?highlight:normal);
        card.setInt(rows[i],"setBackgroundResource",selected?
          (light?R.drawable.widget_active_light:R.drawable.widget_active_dark):
          R.drawable.widget_row_clear);
      }
      card.setTextViewText(R.id.widget_day_footer,ready
          ?"Sıradaki · "+next+"  "+time:"Takvimi açıp eşitle");
      card.setOnClickPendingIntent(R.id.widget_day_root,launchAction(context,41019));
      manager.updateAppWidget(day,card);
      count+=day.length;
    }

    // 1×1: compact, native system countdown without waking React.
    int[] compact=widgetIds[2];
    if(compact.length>0){
      RemoteViews card=new RemoteViews(context.getPackageName(),
          light?R.layout.widget_compact_prayer_light:R.layout.widget_compact_prayer);
      card.setTextViewText(R.id.widget_compact_name,ready?next:"Takvim");
      card.setTextViewText(R.id.widget_compact_time,ready?time:"--:--");
      setCountdown(card,R.id.widget_compact_countdown,nextAt,now);
      card.setViewVisibility(R.id.widget_compact_remaining_row,
          ready?View.VISIBLE:View.GONE);
      card.setOnClickPendingIntent(R.id.widget_compact_root,launchAction(context,41020));
      manager.updateAppWidget(compact,card);
      count+=compact.length;
    }

    // 4×2: focus on the current interval and the remaining time to next.
    int[] focus=widgetIds[3];
    if(focus.length>0){
      RemoteViews card=new RemoteViews(context.getPackageName(),
          light?R.layout.widget_prayer_focus_light:R.layout.widget_prayer_focus);
      int nextIndex=-1;
      for(int i=0;i<times.length();i++){
        if(next.equals(times.getJSONObject(i).optString("label",""))){
          nextIndex=i;break;
        }
      }
      String current=nextIndex<0?"—":
          times.getJSONObject((nextIndex+5)%6).optString("label","—");
      card.setTextViewText(R.id.widget_focus_city,ready?city:"Takvim bekleniyor");
      card.setTextViewText(R.id.widget_focus_current,ready?current:"—");
      card.setTextViewText(R.id.widget_focus_next,ready?"SIRADAKİ · "+next:"SIRADAKİ VAKİT");
      card.setTextViewText(R.id.widget_focus_time,ready?"Saat "+time:"Takvimi açıp eşitle");
      setCountdown(card,R.id.widget_focus_countdown,nextAt,now);
      card.setOnClickPendingIntent(R.id.widget_focus_root,launchAction(context,41021));
      manager.updateAppWidget(focus,card);
      count+=focus.length;
    }
    // Responsive six-prayer strip: six published clocks and a single native
    // countdown (also usable on four-column launchers where 6×2 is impossible).
    int[] strip=widgetIds[4];
    if(strip.length>0){
      RemoteViews card=new RemoteViews(context.getPackageName(),
          light?R.layout.widget_prayer_strip_light:R.layout.widget_prayer_strip);
      int[] cells={R.id.widget_strip_cell_0,R.id.widget_strip_cell_1,
        R.id.widget_strip_cell_2,R.id.widget_strip_cell_3,
        R.id.widget_strip_cell_4,R.id.widget_strip_cell_5};
      int[] labels={R.id.widget_strip_label_0,R.id.widget_strip_label_1,
        R.id.widget_strip_label_2,R.id.widget_strip_label_3,
        R.id.widget_strip_label_4,R.id.widget_strip_label_5};
      int[] clocks={R.id.widget_strip_time_0,R.id.widget_strip_time_1,
        R.id.widget_strip_time_2,R.id.widget_strip_time_3,
        R.id.widget_strip_time_4,R.id.widget_strip_time_5};
      int ordinary=Color.parseColor(light?"#1B415B":"#F2F7FB");
      int subdued=Color.parseColor(light?"#365C78":"#B2C6D6");
      int selectedInk=Color.parseColor(light?"#152821":"#E5C88C");
      for(int i=0;i<6;i++){
        JSONObject value=i<times.length()?times.getJSONObject(i):null;
        String label=value==null?"—":value.optString("label","—");
        String hour=value==null?"--:--":value.optString("time","--:--");
        // The next-day İmsak should not be highlighted in today's list;
        // visually emphasize the currently running Yatsı interval instead.
        boolean selected=ready && (nextInCurrentDay?label.equals(next):i==5);
        card.setTextViewText(labels[i],label);
        card.setTextViewText(clocks[i],hour);
        card.setTextColor(labels[i],selected?selectedInk:subdued);
        card.setTextColor(clocks[i],selected?selectedInk:ordinary);
        card.setInt(cells[i],"setBackgroundResource",selected?
          (light?R.drawable.widget_strip_selected_light:R.drawable.widget_strip_selected_dark):
          R.drawable.widget_row_clear);
      }
      card.setTextViewText(R.id.widget_strip_city,ready?city:"");
      card.setTextViewText(R.id.widget_strip_next,
          ready?next+" vaktine kalan":"Takvim bekleniyor");
      // Keep the footer visible even before the validated calendar arrives:
      // show "Takvim bekleniyor" and a neutral dash rather than an empty area.
      setCountdown(card,R.id.widget_strip_countdown,nextAt,now);
      card.setOnClickPendingIntent(R.id.widget_strip_root,launchAction(context,41022));
      manager.updateAppWidget(strip,card);
      count+=strip.length;
    }


    // Arc bitmap generation is bounded, cached, and off the UI thread.
    // Only create bitmaps for actual installed ring widgets; no per-second JS.
    int[] miniRing=widgetIds[5];
    int[] premiumRing=widgetIds[6];
    if(miniRing.length>0||premiumRing.length>0){
      if(miniRing.length>0){
        RemoteViews card=new RemoteViews(context.getPackageName(),
            light?R.layout.widget_ring_mini_light:R.layout.widget_ring_mini);
        card.setImageViewBitmap(R.id.widget_ring_mini_art,
            PrayerRingBitmapRenderer.render(times,now,false,224));
        card.setTextViewText(R.id.widget_ring_mini_next,ready?next:"Takvim");
        card.setTextViewText(R.id.widget_ring_mini_time,ready?time:"--:--");
        setCountdown(card,R.id.widget_ring_mini_countdown,nextAt,now);
        card.setOnClickPendingIntent(R.id.widget_ring_mini_root,launchAction(context,41023));
        manager.updateAppWidget(miniRing,card);
        count+=miniRing.length;
      }
      if(premiumRing.length>0){
        RemoteViews card=new RemoteViews(context.getPackageName(),
            light?R.layout.widget_ring_premium_light:R.layout.widget_ring_premium);
        card.setImageViewBitmap(R.id.widget_ring_premium_art,
            PrayerRingBitmapRenderer.render(times,now,false,432));
        card.setTextViewText(R.id.widget_ring_premium_next,ready?next:"Takvim");
        card.setTextViewText(R.id.widget_ring_premium_time,ready?"Saat "+time:"--:--");
        card.setTextViewText(R.id.widget_ring_premium_city,ready?city:"Takvim bekleniyor");
        // All six verified daily hours move to a dedicated quiet footer,
        // never floating over the ring or colliding with the live counter.
        int[] hourLabels={R.id.widget_ring_premium_label_0,R.id.widget_ring_premium_label_1,
          R.id.widget_ring_premium_label_2,R.id.widget_ring_premium_label_3,
          R.id.widget_ring_premium_label_4,R.id.widget_ring_premium_label_5};
        int[] hourClocks={R.id.widget_ring_premium_clock_0,R.id.widget_ring_premium_clock_1,
          R.id.widget_ring_premium_clock_2,R.id.widget_ring_premium_clock_3,
          R.id.widget_ring_premium_clock_4,R.id.widget_ring_premium_clock_5};
        int[] hourCells={R.id.widget_ring_premium_cell_0,R.id.widget_ring_premium_cell_1,
          R.id.widget_ring_premium_cell_2,R.id.widget_ring_premium_cell_3,
          R.id.widget_ring_premium_cell_4,R.id.widget_ring_premium_cell_5};
        int mainText=Color.parseColor("#F2F7FB");
        int secondaryText=Color.parseColor("#B2C6D6");
        int activeText=Color.parseColor("#E5C88C");
        for(int i=0;i<6;i++){
          JSONObject value=i<times.length()?times.getJSONObject(i):null;
          String prayer=value==null?"—":value.optString("label","—");
          boolean highlighted=ready &&
              (nextInCurrentDay?prayer.equals(next):i==5);
          card.setTextViewText(hourLabels[i],prayer);
          card.setTextViewText(hourClocks[i],value==null?"--:--":value.optString("time","--:--"));
          card.setTextColor(hourLabels[i],highlighted?activeText:secondaryText);
          card.setTextColor(hourClocks[i],highlighted?activeText:mainText);
          card.setInt(hourCells[i],"setBackgroundResource",highlighted?
              R.drawable.widget_strip_selected_dark:R.drawable.widget_row_clear);
        }
        setCountdown(card,R.id.widget_ring_premium_countdown,nextAt,now);
        card.setOnClickPendingIntent(R.id.widget_ring_premium_root,launchAction(context,41024));
        manager.updateAppWidget(premiumRing,card);
        count+=premiumRing.length;
      }
    }


    // Dedicated narrow 1×2 widget: larger type and no compression of the
    // countdown into the 1×1 minimum launcher footprint.
    int[] slim=widgetIds[7];
    if(slim.length>0){
      RemoteViews card=new RemoteViews(context.getPackageName(),
        light?R.layout.widget_slim_prayer_light:R.layout.widget_slim_prayer);
      card.setTextViewText(R.id.widget_slim_name,ready?next:"Takvim");
      card.setTextViewText(R.id.widget_slim_time,ready?time:"--:--");
      setCountdown(card,R.id.widget_slim_countdown,nextAt,now);
      card.setOnClickPendingIntent(R.id.widget_slim_root,launchAction(context,41025));
      manager.updateAppWidget(slim,card);
      count+=slim.length;
    }

    return count;
  }

  private static PendingIntent alarmIntent(Context context){
    Intent intent=new Intent(context,WidgetBoundaryReceiver.class).setAction(ACTION);
    return PendingIntent.getBroadcast(context,41017,intent,
        PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  }

  private static void scheduleNext(Context context,long next,long now,boolean force){
    SharedPreferences local=prefs(context);
    try{
      AlarmManager manager=(AlarmManager)context.getSystemService(Context.ALARM_SERVICE);
      if(manager==null)throw new IllegalStateException("AlarmManager absent");
      // Keep the existing inexact alarm if its boundary is already correct.
      // Forced rearm is required after reboot, time change or app replacement.
      if(!force&&!alarmRearmRequiredThisProcess&&
          local.getLong("nextAlarmAt",-1)==next)return;
      PendingIntent intent=alarmIntent(context);
      manager.cancel(intent);
      alarmRearmRequiredThisProcess=false;
      if(next<=now){
        local.edit().putLong("nextAlarmAt",0).apply();
        return;
      }
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
    int[] counts=new int[NAMES.length];
    for(int i=0;i<NAMES.length;i++)counts[i]=installedCount(context,NAMES[i]);
    result.put("installedNext",counts[0]);
    result.put("installedDay",counts[1]);
    result.put("installedCompact",counts[2]);
    result.put("installedFocus",counts[3]);
    result.put("installedStrip",counts[4]);
    result.put("installedMiniRing",counts[5]);
    result.put("installedPremiumRing",counts[6]);
    result.put("installedSlim",counts[7]);
    result.put("widgetTheme",lightTheme(context)?"light":"dark");
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
    int count=0;
    for(int installed:counts)count+=installed;
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
    result.put("nativeRefreshMs",lastRefreshMs);
    result.put("nativeCommitMs",lastCommitMs);
    result.put("nativeRenderMs",lastRenderMs);
    result.put("nativeAlarmMs",lastAlarmMs);
    result.put("nativeSkippedRenders",skippedUnchangedRenders);
    result.put("nativeRenderedBatches",renderedBatches);
    WidgetBoundaryAsyncRefresh.appendMetrics(result);
    PrayerRingBitmapRenderer.appendMetrics(result);
    return result;
  }
}
