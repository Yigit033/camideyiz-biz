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
import android.os.Bundle;
import android.os.SystemClock;
import android.util.Log;
import android.util.SizeF;
import android.util.TypedValue;
import android.graphics.Color;
import android.graphics.Bitmap;
import android.widget.RemoteViews;
import android.view.View;

import biz.camideyiz.app.R;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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
  /** Ring widgets turn with the clock like the home dial (now at 12 o'clock). */
  static final String RING_TICK = "biz.camideyiz.app.WIDGET_RING_TICK";
  static final long RING_TICK_MS = 5L * 60 * 1000;
  private static final String[] NAMES = {
    "NextPrayerWidget","PrayerDayWidget","CompactPrayerWidget",
    "PrayerFocusWidget","PrayerStripWidget",
    "MiniPrayerRingWidget","PremiumPrayerRingWidget","SlimPrayerWidget",
    "SquarePrayerRingWidget","PrayerRowWidget","PrayerColumnWidget"
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
  private static volatile long dispatchedFamilies=0;
  private static volatile long skippedFamilies=0;
  private static volatile boolean renderPending=false;
  private static volatile long latestGeneration=0;
  private static volatile String pendingSignature="";
  // 6: larger brand marks, outlined 1×1 with the kerahet outline, six-prayer
  // row/column families (5: theme-specific marks; 4: day/night layouts).
  // Forces one clean repaint of every pinned widget after upgrade.
  private static final int BRAND_VERSION=6;
  // The boundary alarm fires AT the published prayer minute. A delivery
  // that lands a moment early/late must already present the new interval,
  // so the launcher Chronometer never shows a negative "−00:01" countdown.
  private static final long BOUNDARY_LEAD_MS=1500;
  private static final String EXACT_ALARM_STATE=
      "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED";
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
   * Widget appearance for one render pass.
   * auto (Android 12+, app theme = "system"): the LAUNCHER resolves the
   * values/values-night aliases and RemoteViews.setColorInt day/night pairs
   * at inflation time, so a system dark-mode switch (including scheduled
   * sunset switches) repaints instantly without waking this app.
   * Otherwise the app's explicit light/dark choice is applied directly.
   */
  private static final class Look{
    final boolean auto,light;
    Look(boolean auto,boolean light){this.auto=auto;this.light=light;}
    int pick(int lightId,int darkId,int autoId){
      return auto?autoId:(light?lightId:darkId);
    }
  }
  private static Look look(Context context){
    boolean auto=Build.VERSION.SDK_INT>=Build.VERSION_CODES.S&&
        "system".equals(prefs(context).getString("appearance","system"));
    return new Look(auto,lightTheme(context));
  }
  private static String themeKey(Context context){
    Look value=look(context);
    return value.auto?"auto":(value.light?"light":"dark");
  }
  private static void ink(RemoteViews card,Look look,int viewId,int lightColor,int darkColor){
    if(look.auto&&Build.VERSION.SDK_INT>=Build.VERSION_CODES.S){
      card.setColorInt(viewId,"setTextColor",lightColor,darkColor);
    }else{
      card.setTextColor(viewId,look.light?lightColor:darkColor);
    }
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
    // Six prayers, midnight and up to six kerahet edges per published day.
    if (entries == null || entries.length() < 1 || entries.length() > 170)
      throw new JSONException("invalid prayer boundary count");
    if (root.optString("contentKey","").length() > 80)
      throw new JSONException("invalid widget content key");
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
      // Invalidate the old district's in-flight bitmap before persisting the
      // new district. Even a zero-widget selection must reject stale dispatch.
      latestGeneration++;
      renderPending=false;
      pendingSignature="";
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

  /** Snapshot, persistence, rendering, host IPC and alarm are separate
   * phases. Never await Canvas or RemoteViews on the coordinator thread. */
  public static synchronized void refresh(Context context,String reason){
    refresh(context,reason,null);
  }

  /** Broadcast callers retain their goAsync result until the renderer either
   * dispatches the current generation or explicitly drops stale work. */
  public static synchronized void refresh(
      Context context,String reason,Runnable onRendered){
    final long started=SystemClock.elapsedRealtime();
    Context app=context.getApplicationContext();
    SharedPreferences local=prefs(app);
    long now=System.currentTimeMillis();
    long nextBoundary=0;
    int installed=0;
    int ringHosts=0;
    lastRenderMs=0;
    lastCommitMs=0;
    local.edit().putLong("lastAttemptAt",now)
        .putString("lastRefreshReason",reason).apply();
    boolean scheduled=false;
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
            if(at<=now+BOUNDARY_LEAD_MS)selection=item.getJSONObject("props");
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
      ringHosts=inventory.ids[5].length+inventory.ids[6].length+inventory.ids[8].length;
      if(renderPending&&!inventory.signature.equals(pendingSignature)){
        // A calendar/district/installed-host change invalidates all queued
        // rasterized frames, including when zero widgets remain installed.
        latestGeneration++;
        renderPending=false;
        pendingSignature="";
      }
      String[] keys=familyKeys(app,selection,inventory.ids);
      boolean[] dirty=new boolean[NAMES.length];
      boolean any=false;
      boolean force=forceFullRender(reason);
      boolean globalForce=force&&(!reason.startsWith("launcher:update:")||
          "launcher:update:all".equals(reason));
      for(int i=0;i<NAMES.length;i++){
        boolean requestedByLauncher=reason.startsWith("launcher:update:")&&
            reason.endsWith(launcherShortName(i));
        dirty[i]=inventory.ids[i].length>0&&(
            globalForce||requestedByLauncher||
            !keys[i].equals(local.getString("widgetFamilySignature"+i,""))||
            !local.getString("lastError","").isEmpty());
        any|=dirty[i];
        if(inventory.ids[i].length>0&&!dirty[i])skippedFamilies++;
      }
      boolean unchanged=!force&&local.getLong("lastAppliedAt",0)>0&&
          local.getString("lastError","").isEmpty()&&
          inventory.signature.equals(local.getString("lastRenderSignature",""));
      if(unchanged&&!any){
        skippedUnchangedRenders++;
        local.edit().putLong("calendarEndsAt",calendarEndsAt)
            .putLong("calendarSourceAt",sourceAt).apply();
      }else if(any&&renderPending&&inventory.signature.equals(pendingSignature)
          &&!globalForce){
        // A render for this same published snapshot is already in flight.
        skippedUnchangedRenders++;
      }else{
        long committedAt=SystemClock.elapsedRealtime();
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
        if(any){
          local.edit().putInt("lastInstanceCount",installed).apply();
          latestGeneration++;
          long requestGeneration=latestGeneration;
          renderPending=true;
          pendingSignature=inventory.signature;
          // Snapshot and host IDs are immutable for this generation.
          WidgetRenderPipeline.enqueue(app,new JSONObject(selection.toString()),
              inventory.ids,dirty,keys,inventory.signature,requestGeneration,onRendered);
          scheduled=true;
          renderedBatches++;
        }else{
          // No pinned widgets: persist district/clock but never build a bitmap.
          local.edit().putString("lastRenderSignature",inventory.signature)
              .putInt("lastInstanceCount",0).apply();
        }
      }
     }catch(Exception error){
      Log.e(TAG,"Native widget snapshot preparation failed",error);
      local.edit().putString("lastError",
          error.getClass().getSimpleName()+": "+error.getMessage()).apply();
      nextBoundary=0;
    }finally{
      long alarmAt=SystemClock.elapsedRealtime();
      scheduleNext(app,installed>0?nextBoundary:0,now,forceAlarmRearm(reason));
      scheduleRingTick(app,ringHosts>0,now);
      lastAlarmMs=SystemClock.elapsedRealtime()-alarmAt;
      lastRefreshMs=SystemClock.elapsedRealtime()-started;
      if(lastRefreshMs>1500)
        Log.w(TAG,"Slow coordinator stage "+lastRefreshMs+"ms, reason="+reason);
      if(!scheduled&&onRendered!=null)onRendered.run();
    }
  }

  private static String launcherShortName(int index){
    return new String[]{"next","daily","compact","focus","strip",
        "ring:mini","ring:premium","slim","ring:square","row","column"}[index];
  }

  /** Per-family signatures must not include the clock's moving seconds:
   * the Android launcher Chronometer owns that part independently.
   * Installation ID lists are included so replacing a pinned widget forces
   * one clean initial draw even when its family count is unchanged.
   */
  private static String[] familyKeys(Context context,JSONObject props,int[][] ids){
    String city=props.optString("city","");
    String date=props.optString("dateISO","");
    String next=props.optString("nextName","")+"|"+
        props.optString("nextTime","")+"|"+props.optLong("nextAt",0);
    String day=props.optJSONArray("times")==null?"[]":
        props.optJSONArray("times").toString();
    // "auto" stays constant across system day/night switches: the launcher
    // re-resolves resources itself, so no redundant repaint is queued.
    String locale=prefs(context).getInt("activeCityId",0)+"|"+
        themeKey(context)+"|"+props.optBoolean("ready",false)+"|";
    String kerahat=String.valueOf(props.optBoolean("kerahat",false));
    String dated=date+"|"+props.optString("hijriDate","")+"|"+next+"|"+day;
    // Rings are drawn turned to the current time: a new 5-minute turn makes
    // only the three ring families dirty.
    String turn="|t"+(System.currentTimeMillis()/RING_TICK_MS);
    String[] data={city+"|"+next,city+"|"+date+"|"+next+"|"+day,
        next+"|"+kerahat,city+"|"+next,city+"|"+date+"|"+next+"|"+day,
        date+"|"+next+"|"+day+turn,city+"|"+date+"|"+next+"|"+day+turn,next,
        date+"|"+next+"|"+day+turn,dated,dated};
    String[] result=new String[NAMES.length];
    for(int i=0;i<NAMES.length;i++){
      int[] copy=ids[i].clone();
      Arrays.sort(copy);
      result[i]=BRAND_VERSION+"|"+locale+data[i]+"|"+Arrays.toString(copy);
    }
    return result;
  }

  static boolean isCurrentGeneration(long generation){
    return generation==latestGeneration;
  }

  static synchronized void renderFinished(Context context,long generation,
      String[] familyKeys,String signature,int dispatched,long duration){
    if(!isCurrentGeneration(generation))return;
    SharedPreferences local=prefs(context);
    SharedPreferences.Editor edit=local.edit()
        .putString("lastRenderSignature",signature)
        .putLong("lastHostDispatchAt",System.currentTimeMillis())
        .remove("lastError");
    for(int i=0;i<NAMES.length;i++)
      edit.putString("widgetFamilySignature"+i,familyKeys[i]);
    edit.apply();
    lastRenderMs=duration;
    dispatchedFamilies+=dispatched;
    renderPending=false;
    pendingSignature="";
  }

  static synchronized void renderFailed(Context context,long generation,
      Exception failure){
    if(!isCurrentGeneration(generation))return;
    Log.e(TAG,"Native widget render/dispatch failed",failure);
    prefs(context).edit().putString("lastError",
        "render: "+failure.getClass().getSimpleName()+": "+failure.getMessage()).apply();
    renderPending=false;
    pendingSignature="";
  }

  private static boolean forceAlarmRearm(String reason){
    return reason.contains("BOOT_COMPLETED")||reason.contains("TIME_SET")||
        reason.contains("TIMEZONE_CHANGED")||reason.contains("MY_PACKAGE_REPLACED")||
        reason.contains(EXACT_ALARM_STATE);
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

  /** Only eleven binder inventory reads per refresh, including a widget-ID
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
      manager.getAppWidgetIds(component(context,NAMES[7])),
      manager.getAppWidgetIds(component(context,NAMES[8])),
      manager.getAppWidgetIds(component(context,NAMES[9])),
      manager.getAppWidgetIds(component(context,NAMES[10]))
    };
    StringBuilder key=new StringBuilder(600);
    key.append(BRAND_VERSION).append('|')
      .append(prefs(context).getInt("activeCityId",0)).append('|')
      .append(themeKey(context)).append('|')
      .append(props.optBoolean("ready",false)).append('|')
      .append(props.optString("city","")).append('|')
      .append(props.optString("dateISO","")).append('|')
      .append(props.optString("nextName","")).append('|')
      .append(props.optString("nextTime","")).append('|')
      .append(props.optLong("nextAt",0)).append('|')
      .append(props.optBoolean("kerahat",false)).append('|')
      .append(props.optString("hijriDate","")).append('|')
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

  static int renderWidgets(Context context,JSONObject props,int[][] widgetIds,
      boolean[] dirty,Bitmap[] prepared,long generation)throws JSONException {
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
    Look look=look(context);
    boolean kerahat=ready&&props.optBoolean("kerahat",false);
    int count=0;

    // 2×2: published prayer clock and a native, launcher-driven countdown.
    int[] small=widgetIds[0];
    if(small.length>0&&dirty[0]&&isCurrentGeneration(generation)){
      RemoteViews card=new RemoteViews(context.getPackageName(),look.pick(
          R.layout.widget_next_prayer_light,R.layout.widget_next_prayer,
          R.layout.widget_next_prayer_auto));
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
    if(day.length>0&&dirty[1]&&isCurrentGeneration(generation)){
      RemoteViews card=new RemoteViews(context.getPackageName(),look.pick(
          R.layout.widget_prayer_day_light,R.layout.widget_prayer_day,
          R.layout.widget_prayer_day_auto));
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
      int normalLight=Color.parseColor("#123D34"),normalDark=Color.parseColor("#F8F4E9");
      int highlightLight=Color.parseColor("#976B2F"),highlightDark=Color.parseColor("#F0CB8B");
      int activeRow=look.pick(R.drawable.widget_active_light,
          R.drawable.widget_active_dark,R.drawable.widget_active_auto);
      for(int i=0;i<6;i++){
        JSONObject value=i<times.length()?times.getJSONObject(i):null;
        String label=value==null?"—":value.optString("label","—");
        String clock=value==null?"--:--":value.optString("time","--:--");
        boolean selected=ready && (nextInCurrentDay?label.equals(next):i==5);
        card.setTextViewText(icons[i],symbols[i]);
        card.setTextViewText(labels[i],label);
        card.setTextViewText(clocks[i],clock);
        ink(card,look,labels[i],selected?highlightLight:normalLight,
            selected?highlightDark:normalDark);
        ink(card,look,clocks[i],selected?highlightLight:normalLight,
            selected?highlightDark:normalDark);
        card.setInt(rows[i],"setBackgroundResource",
            selected?activeRow:R.drawable.widget_row_clear);
      }
      card.setTextViewText(R.id.widget_day_footer,ready
          ?next+" vaktine kalan":"Takvim bekleniyor");
      setCountdown(card,R.id.widget_day_countdown,nextAt,now);
      card.setOnClickPendingIntent(R.id.widget_day_root,launchAction(context,41019));
      manager.updateAppWidget(day,card);
      count+=day.length;
    }

    // 1×1: compact, native system countdown without waking React.
    int[] compact=widgetIds[2];
    if(compact.length>0&&dirty[2]&&isCurrentGeneration(generation)){
      RemoteViews card=new RemoteViews(context.getPackageName(),look.pick(
          R.layout.widget_compact_prayer_light,R.layout.widget_compact_prayer,
          R.layout.widget_compact_prayer_auto));
      // One line, one autosize pass: "İmsak 06:24" never splits or clips.
      card.setTextViewText(R.id.widget_compact_name,ready?next+"  "+time:"Takvim");
      setCountdown(card,R.id.widget_compact_countdown,nextAt,now);
      card.setViewVisibility(R.id.widget_compact_remaining_row,
          ready?View.VISIBLE:View.GONE);
      // Kerahet: only the "Kalan" box outline turns orange; nothing else moves.
      card.setInt(R.id.widget_compact_remaining_row,"setBackgroundResource",kerahat
          ?look.pick(R.drawable.widget_box_kerahet_light,R.drawable.widget_box_kerahet_dark,
              R.drawable.widget_box_kerahet_auto)
          :look.pick(R.drawable.widget_box_light,R.drawable.widget_box_dark,
              R.drawable.widget_box_auto));
      card.setOnClickPendingIntent(R.id.widget_compact_root,launchAction(context,41020));
      manager.updateAppWidget(compact,card);
      count+=compact.length;
    }

    // 4×2: focus on the current interval and the remaining time to next.
    int[] focus=widgetIds[3];
    if(focus.length>0&&dirty[3]&&isCurrentGeneration(generation)){
      RemoteViews card=new RemoteViews(context.getPackageName(),look.pick(
          R.layout.widget_prayer_focus_light,R.layout.widget_prayer_focus,
          R.layout.widget_prayer_focus_auto));
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
    if(strip.length>0&&dirty[4]&&isCurrentGeneration(generation)){
      RemoteViews card=new RemoteViews(context.getPackageName(),look.pick(
          R.layout.widget_prayer_strip_light,R.layout.widget_prayer_strip,
          R.layout.widget_prayer_strip_auto));
      int[] cells={R.id.widget_strip_cell_0,R.id.widget_strip_cell_1,
        R.id.widget_strip_cell_2,R.id.widget_strip_cell_3,
        R.id.widget_strip_cell_4,R.id.widget_strip_cell_5};
      int[] labels={R.id.widget_strip_label_0,R.id.widget_strip_label_1,
        R.id.widget_strip_label_2,R.id.widget_strip_label_3,
        R.id.widget_strip_label_4,R.id.widget_strip_label_5};
      int[] clocks={R.id.widget_strip_time_0,R.id.widget_strip_time_1,
        R.id.widget_strip_time_2,R.id.widget_strip_time_3,
        R.id.widget_strip_time_4,R.id.widget_strip_time_5};
      int ordinaryLight=Color.parseColor("#1B415B"),ordinaryDark=Color.parseColor("#F2F7FB");
      int subduedLight=Color.parseColor("#365C78"),subduedDark=Color.parseColor("#B2C6D6");
      int selectedLight=Color.parseColor("#152821"),selectedDark=Color.parseColor("#E5C88C");
      int selectedCell=look.pick(R.drawable.widget_strip_selected_light,
          R.drawable.widget_strip_selected_dark,R.drawable.widget_strip_selected_auto);
      for(int i=0;i<6;i++){
        JSONObject value=i<times.length()?times.getJSONObject(i):null;
        String label=value==null?"—":value.optString("label","—");
        String hour=value==null?"--:--":value.optString("time","--:--");
        // The next-day İmsak should not be highlighted in today's list;
        // visually emphasize the currently running Yatsı interval instead.
        boolean selected=ready && (nextInCurrentDay?label.equals(next):i==5);
        card.setTextViewText(labels[i],label);
        card.setTextViewText(clocks[i],hour);
        ink(card,look,labels[i],selected?selectedLight:subduedLight,
            selected?selectedDark:subduedDark);
        ink(card,look,clocks[i],selected?selectedLight:ordinaryLight,
            selected?selectedDark:ordinaryDark);
        card.setInt(cells[i],"setBackgroundResource",
            selected?selectedCell:R.drawable.widget_row_clear);
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
    // Every ring sits in an exact-square frame per launcher-reported size
    // (Android 12+): ColorOS cells are taller than wide, and a frame-relative
    // text box then spilled over the ring stroke.
    int[] miniRing=widgetIds[5];
    int[] premiumRing=widgetIds[6];
    if(miniRing.length>0&&dirty[5]&&isCurrentGeneration(generation)){
      updateRing(manager,miniRing,size->{
        RemoteViews card=new RemoteViews(context.getPackageName(),look.pick(
            R.layout.widget_ring_mini_light,R.layout.widget_ring_mini,
            R.layout.widget_ring_mini_auto));
        squareRingFrame(card,R.id.widget_ring_mini_frame,size,MINI_CHROME_X,MINI_CHROME_Y);
        card.setImageViewBitmap(R.id.widget_ring_mini_art,prepared[0]);
        card.setTextViewText(R.id.widget_ring_mini_next,ready?next:"Takvim");
        card.setTextViewText(R.id.widget_ring_mini_time,ready?time:"--:--");
        setCountdown(card,R.id.widget_ring_mini_countdown,nextAt,now);
        card.setOnClickPendingIntent(R.id.widget_ring_mini_root,launchAction(context,41023));
        return card;
      });
      count+=miniRing.length;
    }
    if(premiumRing.length>0&&dirty[6]&&isCurrentGeneration(generation)){
      updateRing(manager,premiumRing,size->{
        RemoteViews card=new RemoteViews(context.getPackageName(),look.pick(
            R.layout.widget_ring_premium_light,R.layout.widget_ring_premium,
            R.layout.widget_ring_premium_auto));
        squareRingFrame(card,R.id.widget_ring_premium_frame,size,
            PREMIUM_CHROME_X,PREMIUM_CHROME_Y);
        card.setImageViewBitmap(R.id.widget_ring_premium_art,prepared[1]);
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
        // Same day/night palette as the six-prayer strip; the premium ring now
        // follows the selected app/system theme like every other widget.
        int mainLight=Color.parseColor("#152C3D"),mainDark=Color.parseColor("#F2F7FB");
        int secondaryLight=Color.parseColor("#586F7D"),secondaryDark=Color.parseColor("#B2C6D6");
        int activeLight=Color.parseColor("#91652D"),activeDark=Color.parseColor("#E5C88C");
        int activeCell=look.pick(R.drawable.widget_strip_selected_light,
            R.drawable.widget_strip_selected_dark,R.drawable.widget_strip_selected_auto);
        for(int i=0;i<6;i++){
          JSONObject value=i<times.length()?times.getJSONObject(i):null;
          String prayer=value==null?"—":value.optString("label","—");
          boolean highlighted=ready &&
              (nextInCurrentDay?prayer.equals(next):i==5);
          card.setTextViewText(hourLabels[i],prayer);
          card.setTextViewText(hourClocks[i],value==null?"--:--":value.optString("time","--:--"));
          ink(card,look,hourLabels[i],highlighted?activeLight:secondaryLight,
              highlighted?activeDark:secondaryDark);
          ink(card,look,hourClocks[i],highlighted?activeLight:mainLight,
              highlighted?activeDark:mainDark);
          card.setInt(hourCells[i],"setBackgroundResource",
              highlighted?activeCell:R.drawable.widget_row_clear);
        }
        setCountdown(card,R.id.widget_ring_premium_countdown,nextAt,now);
        card.setOnClickPendingIntent(R.id.widget_ring_premium_root,launchAction(context,41024));
        return card;
      });
      count+=premiumRing.length;
    }


    // Dedicated narrow 1×2 widget: larger type and no compression of the
    // countdown into the 1×1 minimum launcher footprint.
    int[] slim=widgetIds[7];
    if(slim.length>0&&dirty[7]&&isCurrentGeneration(generation)){
      RemoteViews card=new RemoteViews(context.getPackageName(),look.pick(
          R.layout.widget_slim_prayer_light,R.layout.widget_slim_prayer,
          R.layout.widget_slim_prayer_auto));
      card.setTextViewText(R.id.widget_slim_name,ready?next:"Takvim");
      card.setTextViewText(R.id.widget_slim_time,ready?time:"--:--");
      setCountdown(card,R.id.widget_slim_countdown,nextAt,now);
      card.setOnClickPendingIntent(R.id.widget_slim_root,launchAction(context,41025));
      manager.updateAppWidget(slim,card);
      count+=slim.length;
    }

    // Fixed 2×2 square ring: the countdown is its central focal point.
    // Reuses the small ring bitmap (no extra JS timer or duplicate allocation).
    int[] squareRing=widgetIds[8];
    if(squareRing.length>0&&dirty[8]&&isCurrentGeneration(generation)){
      updateRing(manager,squareRing,size->{
        RemoteViews card=new RemoteViews(context.getPackageName(),look.pick(
            R.layout.widget_ring_square_light,R.layout.widget_ring_square,
            R.layout.widget_ring_square_auto));
        squareRingFrame(card,R.id.widget_ring_square_frame,size,
            SQUARE_CHROME_X,SQUARE_CHROME_Y);
        card.setImageViewBitmap(R.id.widget_ring_square_art,prepared[0]);
        card.setTextViewText(R.id.widget_ring_square_next,ready?next:"Takvim");
        card.setTextViewText(R.id.widget_ring_square_time,ready?"Saat "+time:"--:--");
        setCountdown(card,R.id.widget_ring_square_countdown,nextAt,now);
        card.setOnClickPendingIntent(R.id.widget_ring_square_root,launchAction(context,41026));
        return card;
      });
      count+=squareRing.length;
    }

    // Six-prayer row (4×1 → 6×1) and column (1×4 → 1×6): one layout per
    // theme and three size buckets. Android 12+ launchers pick the bucket
    // that fits from a responsive map; older launchers get it from options.
    int[] row=widgetIds[9];
    if(row.length>0&&dirty[9]&&isCurrentGeneration(generation)){
      Strip data=new Strip(props,times,ready,next,nextInCurrentDay,nextAt,now);
      if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.S){
        Map<SizeF,RemoteViews> sizes=new HashMap<>();
        for(int bucket=0;bucket<3;bucket++)
          sizes.put(new SizeF(ROW_WIDTHS[bucket],40f),rowCard(context,look,data,bucket));
        manager.updateAppWidget(row,new RemoteViews(sizes));
      }else{
        for(int id:row){
          Bundle options=manager.getAppWidgetOptions(id);
          int width=options==null?0:options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH,0);
          manager.updateAppWidget(id,rowCard(context,look,data,bucketFor(width,ROW_WIDTHS)));
        }
      }
      count+=row.length;
    }
    int[] column=widgetIds[10];
    if(column.length>0&&dirty[10]&&isCurrentGeneration(generation)){
      Strip data=new Strip(props,times,ready,next,nextInCurrentDay,nextAt,now);
      if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.S){
        Map<SizeF,RemoteViews> sizes=new HashMap<>();
        for(int bucket=0;bucket<3;bucket++)
          sizes.put(new SizeF(40f,COLUMN_HEIGHTS[bucket]),columnCard(context,look,data,bucket));
        manager.updateAppWidget(column,new RemoteViews(sizes));
      }else{
        for(int id:column){
          Bundle options=manager.getAppWidgetOptions(id);
          int height=options==null?0:options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT,0);
          manager.updateAppWidget(id,columnCard(context,look,data,bucketFor(height,COLUMN_HEIGHTS)));
        }
      }
      count+=column.length;
    }
    return count;
  }

  // Fixed chrome around each ring stage, in dp (padding, logo/header,
  // margins, footer chip): the ring gets the largest square that remains.
  private static final float MINI_CHROME_X=12f,MINI_CHROME_Y=82f;
  private static final float SQUARE_CHROME_X=10f,SQUARE_CHROME_Y=39f;
  private static final float PREMIUM_CHROME_X=20f,PREMIUM_CHROME_Y=118f;
  /** Launcher sizes may round; keep the ring stroke off the stage edge. */
  private static final float RING_SAFETY_DP=3f;

  private interface RingCard{RemoteViews build(SizeF size)throws JSONException;}

  /** Android 12+: one RemoteViews per launcher-reported size of THIS widget,
   * each with an exact-square ring frame. Older launchers (and launchers that
   * report no size) keep the weighted layout. */
  private static void updateRing(AppWidgetManager manager,int[] ids,RingCard card)
      throws JSONException{
    if(Build.VERSION.SDK_INT<Build.VERSION_CODES.S){
      manager.updateAppWidget(ids,card.build(null));
      return;
    }
    for(int id:ids){
      List<SizeF> sizes=reportedSizes(manager,id);
      if(sizes.isEmpty()){
        manager.updateAppWidget(id,card.build(null));
        continue;
      }
      Map<SizeF,RemoteViews> views=new HashMap<>();
      for(SizeF size:sizes)views.put(size,card.build(size));
      manager.updateAppWidget(id,new RemoteViews(views));
    }
  }

  /** Portrait and landscape sizes (dp) the launcher reported for a widget. */
  @SuppressWarnings("deprecation")
  private static List<SizeF> reportedSizes(AppWidgetManager manager,int id){
    List<SizeF> sizes=new ArrayList<>();
    Bundle options=manager.getAppWidgetOptions(id);
    if(options==null)return sizes;
    if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.S){
      ArrayList<SizeF> reported=
          options.getParcelableArrayList(AppWidgetManager.OPTION_APPWIDGET_SIZES);
      if(reported!=null){
        for(SizeF size:reported){
          // RemoteViews accepts at most 16 sized layouts.
          if(size!=null&&size.getWidth()>0&&size.getHeight()>0&&sizes.size()<16)
            sizes.add(size);
        }
      }
    }
    if(sizes.isEmpty()){
      int portraitW=options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH,0);
      int portraitH=options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT,0);
      int landscapeW=options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH,0);
      int landscapeH=options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT,0);
      if(portraitW>0&&portraitH>0)sizes.add(new SizeF(portraitW,portraitH));
      if(landscapeW>0&&landscapeH>0)sizes.add(new SizeF(landscapeW,landscapeH));
    }
    return sizes;
  }

  /** Sizes the ring frame to the largest square inside its stage. */
  private static void squareRingFrame(RemoteViews card,int frameId,SizeF size,
      float chromeX,float chromeY){
    if(size==null||Build.VERSION.SDK_INT<Build.VERSION_CODES.S)return;
    float side=Math.min(size.getWidth()-chromeX,size.getHeight()-chromeY)-RING_SAFETY_DP;
    if(side<48f)return; // too small to matter: keep the weighted fallback
    card.setViewLayoutWidth(frameId,side,TypedValue.COMPLEX_UNIT_DIP);
    card.setViewLayoutHeight(frameId,side,TypedValue.COMPLEX_UNIT_DIP);
  }

  // Size buckets (dp): logo + six prayers; + remaining time; + dates.
  private static final float[] ROW_WIDTHS={150f,330f,395f};
  private static final float[] COLUMN_HEIGHTS={200f,400f,480f};
  private static final String[] DEFAULT_LABELS={"İmsak","Güneş","Öğle","İkindi","Akşam","Yatsı"};
  private static final int[] ACTIVE_CELLS={R.drawable.widget_cell_on_imsak,
    R.drawable.widget_cell_on_gunes,R.drawable.widget_cell_on_ogle,
    R.drawable.widget_cell_on_ikindi,R.drawable.widget_cell_on_aksam,
    R.drawable.widget_cell_on_yatsi};
  private static final int[] ROW_CELLS={R.id.widget_row_cell_0,R.id.widget_row_cell_1,
    R.id.widget_row_cell_2,R.id.widget_row_cell_3,R.id.widget_row_cell_4,R.id.widget_row_cell_5};
  private static final int[] ROW_ICONS={R.id.widget_row_icon_0,R.id.widget_row_icon_1,
    R.id.widget_row_icon_2,R.id.widget_row_icon_3,R.id.widget_row_icon_4,R.id.widget_row_icon_5};
  private static final int[] ROW_LABELS={R.id.widget_row_label_0,R.id.widget_row_label_1,
    R.id.widget_row_label_2,R.id.widget_row_label_3,R.id.widget_row_label_4,R.id.widget_row_label_5};
  private static final int[] ROW_TIMES={R.id.widget_row_time_0,R.id.widget_row_time_1,
    R.id.widget_row_time_2,R.id.widget_row_time_3,R.id.widget_row_time_4,R.id.widget_row_time_5};
  private static final int[] COL_CELLS={R.id.widget_col_cell_0,R.id.widget_col_cell_1,
    R.id.widget_col_cell_2,R.id.widget_col_cell_3,R.id.widget_col_cell_4,R.id.widget_col_cell_5};
  private static final int[] COL_ICONS={R.id.widget_col_icon_0,R.id.widget_col_icon_1,
    R.id.widget_col_icon_2,R.id.widget_col_icon_3,R.id.widget_col_icon_4,R.id.widget_col_icon_5};
  private static final int[] COL_LABELS={R.id.widget_col_label_0,R.id.widget_col_label_1,
    R.id.widget_col_label_2,R.id.widget_col_label_3,R.id.widget_col_label_4,R.id.widget_col_label_5};
  private static final int[] COL_TIMES={R.id.widget_col_time_0,R.id.widget_col_time_1,
    R.id.widget_col_time_2,R.id.widget_col_time_3,R.id.widget_col_time_4,R.id.widget_col_time_5};

  /** Unknown size (0) falls back to the middle bucket, the default 4×1/1×4. */
  private static int bucketFor(int dp,float[] edges){
    if(dp<=0)return 1;
    return dp>=edges[2]?2:dp>=edges[1]?1:0;
  }

  /** Everything the row and column draw, read once per render pass. */
  private static final class Strip{
    final boolean ready;
    final int current;
    final String[] labels=new String[6],clocks=new String[6];
    final String title,hijri,date,weekday;
    final long nextAt,now;
    Strip(JSONObject props,JSONArray times,boolean ready,String next,
        boolean nextInCurrentDay,long nextAt,long now){
      this.ready=ready;this.nextAt=nextAt;this.now=now;
      int nextIndex=-1;
      for(int i=0;i<6;i++){
        JSONObject value=i<times.length()?times.optJSONObject(i):null;
        labels[i]=value==null?DEFAULT_LABELS[i]:value.optString("label",DEFAULT_LABELS[i]);
        clocks[i]=value==null?"--:--":value.optString("time","--:--");
        if(ready&&labels[i].equals(next))nextIndex=i;
      }
      // Highlight the CURRENT prayer period, as on the app's home screen.
      // After Yatsı the next İmsak is tomorrow, so the period is Yatsı.
      current=!ready?-1:!nextInCurrentDay?5:nextIndex<0?-1:(nextIndex+5)%6;
      title=remainingTitle(ready?next:"");
      hijri=ready?props.optString("hijriDate","").trim():"";
      String[] day=gregorian(props.optString("dateISO",""));
      date=day[0];weekday=day[1];
    }
  }

  private static String remainingTitle(String next){
    switch(next){
      case "İmsak":return "İmsağa Kalan";
      case "Güneş":return "Güneşe Kalan";
      case "Öğle":return "Öğleye Kalan";
      case "İkindi":return "İkindiye Kalan";
      case "Akşam":return "Akşama Kalan";
      case "Yatsı":return "Yatsıya Kalan";
      default:return "Kalan";
    }
  }

  /** "22 Kasım 2026" and "Pazar" for a published Europe/Istanbul date. */
  private static String[] gregorian(String dateISO){
    try{
      TimeZone zone=TimeZone.getTimeZone("Europe/Istanbul");
      SimpleDateFormat parse=new SimpleDateFormat("yyyy-MM-dd",Locale.US);
      parse.setTimeZone(zone);
      Date day=parse.parse(dateISO);
      Locale turkish=Locale.forLanguageTag("tr-TR");
      SimpleDateFormat date=new SimpleDateFormat("d MMMM yyyy",turkish);
      SimpleDateFormat week=new SimpleDateFormat("EEEE",turkish);
      date.setTimeZone(zone);week.setTimeZone(zone);
      return new String[]{date.format(day),week.format(day)};
    }catch(Exception invalid){
      return new String[]{"",""};
    }
  }

  private static void tint(RemoteViews card,Look look,int viewId,int lightColor,int darkColor){
    if(look.auto&&Build.VERSION.SDK_INT>=Build.VERSION_CODES.S){
      card.setColorInt(viewId,"setColorFilter",lightColor,darkColor);
    }else{
      card.setInt(viewId,"setColorFilter",look.light?lightColor:darkColor);
    }
  }

  /** Current period = the prayer's own colour; dark ink reads on every
   * prayer colour except Yatsı's violet, which takes white. */
  private static void paintCells(RemoteViews card,Look look,Strip data,
      int[] cells,int[] icons,int[] labels,int[] clocks){
    // Same inks as the layouts (scripts/sync-widget-light-layouts.mjs tokens).
    int textLight=Color.parseColor("#163045"),textDark=Color.parseColor("#F1F7F8");
    int iconLight=Color.parseColor("#A88A5C"),iconDark=Color.parseColor("#F0C97F");
    int plain=look.pick(R.drawable.widget_cell_light,R.drawable.widget_cell_dark,
        R.drawable.widget_cell_auto);
    for(int i=0;i<6;i++){
      boolean on=i==data.current;
      int onInk=i==5?Color.WHITE:Color.parseColor("#04121C");
      card.setTextViewText(labels[i],data.labels[i]);
      card.setTextViewText(clocks[i],data.clocks[i]);
      card.setInt(cells[i],"setBackgroundResource",on?ACTIVE_CELLS[i]:plain);
      ink(card,look,labels[i],on?onInk:textLight,on?onInk:textDark);
      ink(card,look,clocks[i],on?onInk:textLight,on?onInk:textDark);
      tint(card,look,icons[i],on?onInk:iconLight,on?onInk:iconDark);
    }
  }

  private static RemoteViews rowCard(Context context,Look look,Strip data,int bucket){
    RemoteViews card=new RemoteViews(context.getPackageName(),look.pick(
        R.layout.widget_prayer_row_light,R.layout.widget_prayer_row,
        R.layout.widget_prayer_row_auto));
    card.setViewVisibility(R.id.widget_row_logo,bucket==2?View.GONE:View.VISIBLE);
    card.setViewVisibility(R.id.widget_row_brand,bucket==2?View.VISIBLE:View.GONE);
    card.setViewVisibility(R.id.widget_row_remaining,
        bucket>=1&&data.ready?View.VISIBLE:View.GONE);
    if(bucket==2){
      card.setTextViewText(R.id.widget_row_hijri,data.hijri);
      card.setViewVisibility(R.id.widget_row_hijri,data.hijri.isEmpty()?View.GONE:View.VISIBLE);
      card.setTextViewText(R.id.widget_row_date,
          data.weekday.isEmpty()?data.date:data.date+" "+data.weekday);
    }
    paintCells(card,look,data,ROW_CELLS,ROW_ICONS,ROW_LABELS,ROW_TIMES);
    card.setTextViewText(R.id.widget_row_next,data.title);
    setCountdown(card,R.id.widget_row_countdown,data.nextAt,data.now);
    card.setOnClickPendingIntent(R.id.widget_row_root,launchAction(context,41027));
    return card;
  }

  private static RemoteViews columnCard(Context context,Look look,Strip data,int bucket){
    RemoteViews card=new RemoteViews(context.getPackageName(),look.pick(
        R.layout.widget_prayer_column_light,R.layout.widget_prayer_column,
        R.layout.widget_prayer_column_auto));
    card.setViewVisibility(R.id.widget_col_logo,bucket==2?View.GONE:View.VISIBLE);
    card.setViewVisibility(R.id.widget_col_brand,bucket==2?View.VISIBLE:View.GONE);
    card.setViewVisibility(R.id.widget_col_remaining,
        bucket>=1&&data.ready?View.VISIBLE:View.GONE);
    if(bucket==2){
      // A one-column card is narrow: "13 Cemaziyelahir" / "1448".
      int split=data.hijri.lastIndexOf(' ');
      String hijriDay=split>0?data.hijri.substring(0,split):data.hijri;
      String hijriYear=split>0?data.hijri.substring(split+1):"";
      card.setTextViewText(R.id.widget_col_hijri_day,hijriDay);
      card.setTextViewText(R.id.widget_col_hijri_year,hijriYear);
      card.setViewVisibility(R.id.widget_col_hijri_day,hijriDay.isEmpty()?View.GONE:View.VISIBLE);
      card.setViewVisibility(R.id.widget_col_hijri_year,hijriYear.isEmpty()?View.GONE:View.VISIBLE);
      card.setTextViewText(R.id.widget_col_date,data.date);
      card.setTextViewText(R.id.widget_col_weekday,data.weekday);
    }
    paintCells(card,look,data,COL_CELLS,COL_ICONS,COL_LABELS,COL_TIMES);
    card.setTextViewText(R.id.widget_col_next,data.title.endsWith(" Kalan")
        ?data.title.substring(0,data.title.length()-" Kalan".length()):"");
    setCountdown(card,R.id.widget_col_countdown,data.nextAt,data.now);
    card.setOnClickPendingIntent(R.id.widget_col_root,launchAction(context,41028));
    return card;
  }

  /**
   * Turns the ring widgets every five minutes with a NON-wakeup alarm: it is
   * delivered only while the phone is awake (screen on), so a sleeping phone
   * pays nothing, and the first wake-up turns the ring at once. Cancelled
   * when no ring widget is pinned.
   */
  private static void scheduleRingTick(Context context,boolean rings,long now){
    try{
      AlarmManager manager=(AlarmManager)context.getSystemService(Context.ALARM_SERVICE);
      if(manager==null)return;
      Intent intent=new Intent(context,WidgetBoundaryReceiver.class).setAction(RING_TICK);
      PendingIntent tick=PendingIntent.getBroadcast(context,41029,intent,
          PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
      if(!rings){
        manager.cancel(tick);
        return;
      }
      manager.set(AlarmManager.RTC,(now/RING_TICK_MS+1)*RING_TICK_MS,tick);
    }catch(RuntimeException failure){
      Log.w(TAG,"Ring turn alarm not scheduled",failure);
    }
  }

  private static PendingIntent alarmIntent(Context context){
    Intent intent=new Intent(context,WidgetBoundaryReceiver.class).setAction(ACTION);
    return PendingIntent.getBroadcast(context,41017,intent,
        PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  }

  /** Exact delivery is possible on Android 6–11, and on 12+ only while the
   * user-granted "Alarms & reminders" access (already requested for ezan)
   * is active. Never assumes the permission. */
  private static boolean exactAlarmAllowed(AlarmManager manager){
    if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.S){
      return manager.canScheduleExactAlarms();
    }
    return true;
  }

  /**
   * One boundary alarm for all nine widget families (about seven per day).
   * Exact when permitted, so the widget switches to the next prayer at the
   * published minute instead of minutes later under Doze/inexact batching.
   * The inexact path remains a safe fallback; the launcher's 30 min
   * updatePeriodMillis still bounds the worst-case delay.
   */
  private static void scheduleNext(Context context,long next,long now,boolean force){
    SharedPreferences local=prefs(context);
    try{
      AlarmManager manager=(AlarmManager)context.getSystemService(Context.ALARM_SERVICE);
      if(manager==null)throw new IllegalStateException("AlarmManager absent");
      boolean exact=exactAlarmAllowed(manager);
      // Keep the existing alarm if its boundary and precision are unchanged.
      // Forced rearm is required after reboot, time change, app replacement
      // or an exact-alarm permission grant.
      if(!force&&!alarmRearmRequiredThisProcess&&
          local.getLong("nextAlarmAt",-1)==next&&
          local.getBoolean("nextAlarmExact",false)==exact)return;
      PendingIntent intent=alarmIntent(context);
      manager.cancel(intent);
      alarmRearmRequiredThisProcess=false;
      if(next<=now){
        local.edit().putLong("nextAlarmAt",0).putBoolean("nextAlarmExact",false).apply();
        return;
      }
      boolean scheduledExact=false;
      if(exact){
        try{
          manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,next,intent);
          scheduledExact=true;
        }catch(SecurityException revoked){
          // Permission revoked between the check and the call.
          Log.w(TAG,"Exact widget alarm denied; using inexact fallback",revoked);
        }
      }
      if(!scheduledExact){
        manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,next,intent);
      }
      local.edit().putLong("nextAlarmAt",next)
          .putBoolean("nextAlarmExact",scheduledExact).apply();
    }catch(Exception error){
      local.edit().putLong("nextAlarmAt",0).putBoolean("nextAlarmExact",false)
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
    result.put("installedSquareRing",counts[8]);
    result.put("installedRow",counts[9]);
    result.put("installedColumn",counts[10]);
    Look appearance=look(context);
    result.put("widgetTheme",appearance.auto?"auto":(appearance.light?"light":"dark"));
    long last=local.getLong("lastAppliedAt",0);
    result.put("lastAppliedAt",last);
    result.put("nextAlarmAt",local.getLong("nextAlarmAt",0));
    result.put("nextAlarmExact",local.getBoolean("nextAlarmExact",false));
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
    String contentKey="";
    if(hasTimeline) {
      try {
        JSONObject calendar=new JSONObject(local.getString(CALENDAR,""));
        nativeCityId=calendar.optInt("cityId",0);
        contentKey=calendar.optString("contentKey","");
      }catch(JSONException ignored){}
    }
    result.put("nativeCityId",nativeCityId);
    // Payload revision + kerahet settings the timeline was built with; the
    // app republishes when either differs from what it would publish now.
    result.put("calendarContentKey",contentKey);
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
    result.put("nativeDispatchedFamilies",dispatchedFamilies);
    result.put("nativeSkippedFamilies",skippedFamilies);
    result.put("nativeRenderPending",renderPending);
    result.put("nativeGeneration",latestGeneration);
    result.put("brandAssetVersion",BRAND_VERSION);
    WidgetRenderPipeline.appendMetrics(result);
    WidgetBoundaryAsyncRefresh.appendMetrics(result);
    PrayerRingBitmapRenderer.appendMetrics(result);
    return result;
  }
}
