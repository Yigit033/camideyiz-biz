package biz.camideyiz.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import biz.camideyiz.app.widget.WidgetBoundaryAsyncRefresh;

/** Same provider component name as previous Expo widget; keep home-screen pins. */
public final class PrayerDayWidgetProvider extends AppWidgetProvider {
  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
    WidgetBoundaryAsyncRefresh.dispatch(context,goAsync(),"launcher:update:daily");
  }

  @Override
  public void onDisabled(Context context) {
    // The last widget of this provider was removed. Cancel unnecessary alarms
    // when neither provider has installed instances; never block the UI thread.
    WidgetBoundaryAsyncRefresh.dispatch(context,goAsync(),"launcher:disabled:daily");
  }
}
