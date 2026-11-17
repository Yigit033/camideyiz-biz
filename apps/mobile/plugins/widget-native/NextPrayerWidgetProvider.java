package biz.camideyiz.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import biz.camideyiz.app.widget.WidgetBoundaryScheduler;

/** Same component class as Expo's previous provider; upgrading retains pinned IDs. */
public final class NextPrayerWidgetProvider extends AppWidgetProvider {
  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
    WidgetBoundaryScheduler.refresh(context.getApplicationContext());
  }
}
