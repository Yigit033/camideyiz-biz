package biz.camideyiz.app.widget;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * Receives inexact prayer-boundary alarms and system changes. No network
 * access or React JS process is needed; only verified precomputed props
 * from a previously published district calendar may be presented.
 */
public final class WidgetBoundaryReceiver extends BroadcastReceiver {
  private static final String TAG = "CamideyizWidgetP0";

  @Override
  public void onReceive(Context context, Intent intent) {
    if (intent == null || intent.getAction() == null) return;
    String action = intent.getAction();
    if (!action.equals("biz.camideyiz.app.WIDGET_BOUNDARY") &&
        !action.equals(Intent.ACTION_BOOT_COMPLETED) &&
        !action.equals(Intent.ACTION_TIME_CHANGED) &&
        !action.equals(Intent.ACTION_TIMEZONE_CHANGED) &&
        !action.equals(Intent.ACTION_MY_PACKAGE_REPLACED)) return;
    try {
      WidgetBoundaryScheduler.refresh(context.getApplicationContext());
    } catch (Exception error) {
      Log.e(TAG, "Cannot handle widget boundary/system event", error);
    }
  }
}
