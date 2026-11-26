package biz.camideyiz.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;
import biz.camideyiz.app.widget.WidgetBoundaryAsyncRefresh;

/** Widget refresh off main thread; ring is rendered only when installed. */
public final class MiniPrayerRingWidgetProvider extends AppWidgetProvider {
  @Override public void onUpdate(Context context,AppWidgetManager manager,int[] ids){
    WidgetBoundaryAsyncRefresh.dispatch(context,goAsync(),"launcher:update:ring:mini");
  }
  /** Resizes change the exact-square ring frame (Android 12+ sizes). */
  @Override public void onAppWidgetOptionsChanged(Context context,AppWidgetManager manager,
      int id,Bundle options){
    WidgetBoundaryAsyncRefresh.dispatch(context,goAsync(),"launcher:update:ring:mini");
  }
  @Override public void onDisabled(Context context){
    WidgetBoundaryAsyncRefresh.dispatch(context,goAsync(),"launcher:disabled:ring:mini");
  }
}
