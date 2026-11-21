package biz.camideyiz.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import biz.camideyiz.app.widget.WidgetBoundaryAsyncRefresh;

/** Six-column layout; resizable on launchers with 6 physical grid columns. */
public final class PrayerStripWidgetProvider extends AppWidgetProvider {
  @Override public void onUpdate(Context context,AppWidgetManager manager,int[] ids){
    WidgetBoundaryAsyncRefresh.dispatch(context,goAsync(),"launcher:update:strip");
  }
  @Override public void onDisabled(Context context){
    WidgetBoundaryAsyncRefresh.dispatch(context,goAsync(),"launcher:disabled:strip");
  }
}
