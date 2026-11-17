package biz.camideyiz.app.widget;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Android-only precomputed prayer-boundary refresher.
 *
 * Expo Widgets Android only supports updateSnapshot, not updateTimeline.
 * JS supplies an already verified district calendar converted to boundary
 * snapshots; these are persisted before returning to JS. An Android inexact
 * alarm recomputes the effective snapshot at wake time, writes Expo Widgets'
 * documented-in-source SharedPreferences keys, and broadcasts a refresh to
 * the actual Glance widget providers without starting the React runtime.
 *
 * NO invented prayer times and NO exact-alarm/notification permission.
 * In Doze, AlarmManager may deliver late. Last-write/instance diagnostics
 * attest only native storage and broadcast, never launcher pixel rendering.
 */
final class WidgetBoundaryScheduler {
  private static final String TAG = "CamideyizWidgetP0";
  private static final String PREFS = "camideyiz.widget.boundaries.v1";
  private static final String EXPO_PREFS = "expo.modules.widgets";
  private static final String CALENDAR = "timeline";
  private static final String ACTION = "biz.camideyiz.app.WIDGET_BOUNDARY";
  private static final String[] NAMES = {"NextPrayerWidget", "PrayerDayWidget"};
  private static final long MAX_AGE = 72L * 60 * 60 * 1000;
  private static final long MAX_FUTURE = 17L * 24 * 60 * 60 * 1000;

  private WidgetBoundaryScheduler() {}

  private static SharedPreferences prefs(Context context) {
    return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
  }

  private static JSONObject parseAndValidate(String raw, long now) throws JSONException {
    JSONObject root = new JSONObject(raw);
    if (root.optInt("version") != 1 || root.optInt("cityId") <= 0 ||
        root.optString("city").trim().isEmpty())
      throw new JSONException("invalid district identity");
    long generatedAt = root.optLong("generatedAt", -1);
    if (generatedAt < now - 60_000 || generatedAt > now + 60_000)
      throw new JSONException("outdated widget sync request");
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

  static synchronized JSONObject publish(Context context, String raw) throws JSONException {
    Context app = context.getApplicationContext();
    long now = System.currentTimeMillis();
    if (raw == null || raw.isEmpty()) {
      prefs(app).edit().remove(CALENDAR).putLong("lastSyncAt", now).commit();
    } else {
      JSONObject validated = parseAndValidate(raw, now);
      if (!prefs(app).edit().putString(CALENDAR, validated.toString())
          .putLong("lastSyncAt", now).commit())
        throw new JSONException("cannot persist native prayer timeline");
    }
    refresh(app);
    return status(app);
  }

  static synchronized void refresh(Context context) {
    Context app = context.getApplicationContext();
    long now = System.currentTimeMillis();
    SharedPreferences nativePrefs = prefs(app);
    JSONObject selection = null;
    long nextBoundary = 0;
    String raw = nativePrefs.getString(CALENDAR, null);
    try {
      if (raw != null) {
        JSONObject root = new JSONObject(raw);
        long generatedAt = root.getLong("generatedAt");
        // A 72h offline ceiling prevents an old district calendar from being
        // presented as a new published timetable after prolonged inactivity.
        if (generatedAt <= now && now - generatedAt <= MAX_AGE) {
          JSONArray entries = root.getJSONArray("entries");
          for (int i = 0; i < entries.length(); i++) {
            JSONObject item = entries.getJSONObject(i);
            long at = item.getLong("at");
            if (at <= now) selection = item.getJSONObject("props");
            else { nextBoundary = at; break; }
          }
          long expiresAt = generatedAt + MAX_AGE;
          if (nextBoundary == 0 || nextBoundary > expiresAt) {
            nextBoundary = expiresAt > now ? expiresAt : 0;
          }
        }
      }
      if (selection == null) selection = emptyProps(now);
      // The on-device refresh time must not masquerade as the date the source
      // timetable was published. It describes only this widget re-render.
      selection.put("updatedAt", now);
      selection.put("updatedClock", clock(now));
      selection.put("nativeAppliedAt", now);
      SharedPreferences.Editor editor =
          app.getSharedPreferences(EXPO_PREFS, Context.MODE_PRIVATE).edit();
      for (String name : NAMES) {
        editor.putString("__expo_widgets_" + name + "_props", selection.toString());
      }
      if (!editor.commit()) throw new IllegalStateException("expo props not committed");
      int count = broadcastWidgetRefresh(app);
      nativePrefs.edit()
          .putLong("lastAppliedAt", now)
          .putString("lastNextName", selection.optString("nextName", ""))
          .putString("lastNextTime", selection.optString("nextTime", ""))
          .putString("lastCity", selection.optString("city", ""))
          .putString("lastDateISO", selection.optString("dateISO", ""))
          .putBoolean("lastReady", selection.optBoolean("ready", false))
          .putInt("lastInstanceCount", count)
          .remove("lastError").apply();
    } catch (Exception error) {
      Log.e(TAG, "Native widget boundary refresh failed", error);
      nativePrefs.edit().putString("lastError", error.getClass().getSimpleName()
          + ": " + error.getMessage()).apply();
      // Clear any scheduled alarm rather than looping rapidly on corruption.
      nextBoundary = 0;
    }
    scheduleNext(app, nextBoundary, now);
  }

  private static JSONObject emptyProps(long now) throws JSONException {
    JSONObject props = new JSONObject();
    props.put("ready", false);
    props.put("city", "Konum seç");
    props.put("dateISO", "");
    props.put("nextName", "Takvimi aç");
    props.put("nextTime", "");
    props.put("nextAt", 0);
    props.put("updatedAt", now);
    props.put("remainingMinutes", 0);
    props.put("updatedClock", clock(now));
    props.put("times", new JSONArray());
    return props;
  }

  private static String clock(long now) {
    SimpleDateFormat formatter = new SimpleDateFormat("HH:mm", Locale.forLanguageTag("tr-TR"));
    formatter.setTimeZone(TimeZone.getTimeZone("Europe/Istanbul"));
    return formatter.format(new Date(now));
  }

  private static int installedCount(Context context, String widget) {
    try {
      ComponentName component = new ComponentName(
          context.getPackageName(), context.getPackageName() + "." + widget + "Provider");
      return AppWidgetManager.getInstance(context).getAppWidgetIds(component).length;
    } catch (Exception ignored) { return 0; }
  }

  private static int broadcastWidgetRefresh(Context context) {
    AppWidgetManager manager = AppWidgetManager.getInstance(context);
    int installed = 0;
    for (String name : NAMES) {
      ComponentName component = new ComponentName(
          context.getPackageName(), context.getPackageName() + "." + name + "Provider");
      int[] ids = manager.getAppWidgetIds(component);
      installed += ids.length;
      if (ids.length == 0) continue;
      Intent refresh = new Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
      refresh.setComponent(component);
      refresh.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
      refresh.addFlags(Intent.FLAG_RECEIVER_FOREGROUND);
      context.sendBroadcast(refresh);
    }
    return installed;
  }

  private static PendingIntent alarmIntent(Context context) {
    Intent intent = new Intent(context, WidgetBoundaryReceiver.class).setAction(ACTION);
    return PendingIntent.getBroadcast(context, 41017, intent,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
  }

  private static void scheduleNext(Context context, long next, long now) {
    SharedPreferences preferences = prefs(context);
    try {
      AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
      if (manager == null) throw new IllegalStateException("AlarmManager absent");
      PendingIntent intent = alarmIntent(context);
      manager.cancel(intent);
      if (next <= now) {
        preferences.edit().putLong("nextAlarmAt", 0).apply();
        return;
      }
      // Do not request exact-alarm permissions. setAndAllowWhileIdle is an
      // inexact wakeup, delivered no earlier than the prayer boundary.
      manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next + 1200, intent);
      preferences.edit().putLong("nextAlarmAt", next).apply();
    } catch (Exception exception) {
      preferences.edit().putLong("nextAlarmAt", 0)
          .putString("lastError", "alarm: " + exception.getMessage()).apply();
    }
  }

  static JSONObject status(Context context) throws JSONException {
    SharedPreferences local = prefs(context);
    SharedPreferences expo = context.getSharedPreferences(EXPO_PREFS, Context.MODE_PRIVATE);
    JSONObject state = new JSONObject();
    state.put("supported", true);
    state.put("installedNext", installedCount(context, NAMES[0]));
    state.put("installedDay", installedCount(context, NAMES[1]));
    state.put("lastAppliedAt", local.getLong("lastAppliedAt", 0));
    state.put("nextAlarmAt", local.getLong("nextAlarmAt", 0));
    state.put("lastSyncAt", local.getLong("lastSyncAt", 0));
    state.put("lastError", local.getString("lastError", ""));
    state.put("lastNextName", local.getString("lastNextName", ""));
    state.put("lastNextTime", local.getString("lastNextTime", ""));
    state.put("lastCity", local.getString("lastCity", ""));
    state.put("lastDateISO", local.getString("lastDateISO", ""));
    state.put("lastReady", local.getBoolean("lastReady", false));
    String next = expo.getString("__expo_widgets_NextPrayerWidget_props", "");
    String day = expo.getString("__expo_widgets_PrayerDayWidget_props", "");
    boolean persisted = false;
    try {
      JSONObject a = new JSONObject(next);
      JSONObject b = new JSONObject(day);
      long at = local.getLong("lastAppliedAt", 0);
      persisted = at > 0 && a.optLong("nativeAppliedAt") == at &&
          b.optLong("nativeAppliedAt") == at &&
          a.optString("nextName").equals(b.optString("nextName"));
    } catch (JSONException ignored) {}
    state.put("persisted", persisted);
    state.put("hasTimeline", local.contains(CALENDAR));
    // Not a rendering acknowledgment: Android's launcher is another process.
    state.put("launcherConfirmed", false);
    return state;
  }
}
