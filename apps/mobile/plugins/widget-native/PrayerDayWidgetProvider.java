package biz.camideyiz.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import biz.camideyiz.app.widget.WidgetBoundaryScheduler;

/** Same provider component name as previous Expo widget; keep home-screen pins. */
public final class PrayerDayWidgetProvider extends AppWidgetProvider {
  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
    WidgetBoundaryScheduler.refresh(context.getApplicationContext());
  }
}
