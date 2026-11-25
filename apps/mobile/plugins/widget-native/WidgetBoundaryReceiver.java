package biz.camideyiz.app.widget;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Receives inexact prayer-boundary alarms and system changes. No network
 * access or React JS process is needed; only verified precomputed props
 * from a previously published district calendar may be presented.
 */
public final class WidgetBoundaryReceiver extends BroadcastReceiver {
  // Android 12+: sent when the user grants "Alarms & reminders"; the widget
  // boundary alarm is then re-armed as an exact alarm immediately.
  static final String EXACT_ALARM_STATE =
      "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED";

  @Override
  public void onReceive(Context context, Intent intent) {
    if (intent == null || intent.getAction() == null) return;
    String action = intent.getAction();
    if (!action.equals("biz.camideyiz.app.WIDGET_BOUNDARY") &&
        !action.equals(WidgetBoundaryScheduler.RING_TICK) &&
        !action.equals(Intent.ACTION_BOOT_COMPLETED) &&
        !action.equals(Intent.ACTION_TIME_CHANGED) &&
        !action.equals(Intent.ACTION_TIMEZONE_CHANGED) &&
        !action.equals(Intent.ACTION_MY_PACKAGE_REPLACED) &&
        !action.equals(EXACT_ALARM_STATE)) return;
    WidgetBoundaryAsyncRefresh.dispatch(context,goAsync(),"receiver:"+action);
  }
}
