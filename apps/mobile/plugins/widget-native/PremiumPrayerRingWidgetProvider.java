package biz.camideyiz.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import biz.camideyiz.app.widget.WidgetBoundaryAsyncRefresh;

/** Widget refresh off main thread; ring is rendered only when installed. */
public final class PremiumPrayerRingWidgetProvider extends AppWidgetProvider {
  @Override public void onUpdate(Context context,AppWidgetManager manager,int[] ids){
    WidgetBoundaryAsyncRefresh.dispatch(context,goAsync(),"launcher:update:ring:premium");
  }
  @Override public void onDisabled(Context context){
    WidgetBoundaryAsyncRefresh.dispatch(context,goAsync(),"launcher:disabled:ring:premium");
  }
}
