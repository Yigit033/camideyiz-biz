package biz.camideyiz.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import biz.camideyiz.app.widget.WidgetBoundaryAsyncRefresh;

/** Narrow 1×2 column; reuses the verified calendar and native ticker. */
public final class SlimPrayerWidgetProvider extends AppWidgetProvider {
  @Override public void onUpdate(Context context,AppWidgetManager manager,int[] ids){
    WidgetBoundaryAsyncRefresh.dispatch(context,goAsync(),"launcher:update:slim");
  }
  @Override public void onDisabled(Context context){
    WidgetBoundaryAsyncRefresh.dispatch(context,goAsync(),"launcher:disabled:slim");
  }
}
