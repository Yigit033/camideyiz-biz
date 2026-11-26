package biz.camideyiz.app;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;
import biz.camideyiz.app.widget.WidgetBoundaryAsyncRefresh;
/** Resizable six-prayer column; no JavaScript or network. A resize repaints
 * the size bucket on launchers that do not pick responsive layouts. */
public final class PrayerColumnWidgetProvider extends AppWidgetProvider {
  @Override public void onUpdate(Context context,AppWidgetManager manager,int[] ids){
    WidgetBoundaryAsyncRefresh.dispatch(context,goAsync(),"launcher:update:column");
  }
  @Override public void onAppWidgetOptionsChanged(Context context,AppWidgetManager manager,
      int id,Bundle options){
    WidgetBoundaryAsyncRefresh.dispatch(context,goAsync(),"launcher:update:column");
  }
  @Override public void onDisabled(Context context){
    WidgetBoundaryAsyncRefresh.dispatch(context,goAsync(),"launcher:disabled:column");
  }
}
