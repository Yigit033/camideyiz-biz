package biz.camideyiz.app;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;
import biz.camideyiz.app.widget.WidgetBoundaryAsyncRefresh;
/** Lightweight native provider; no JavaScript or network. */
public final class PrayerFocusWidgetProvider extends AppWidgetProvider {
  @Override public void onUpdate(Context context,AppWidgetManager manager,int[] ids){
    WidgetBoundaryAsyncRefresh.dispatch(context,goAsync(),"launcher:update:focus");
  }
  /** A resize refits the header dates to the new size. */
  @Override public void onAppWidgetOptionsChanged(Context context,AppWidgetManager manager,
      int id,Bundle options){
    WidgetBoundaryAsyncRefresh.dispatch(context,goAsync(),"launcher:update:focus");
  }
  @Override public void onDisabled(Context context){
    WidgetBoundaryAsyncRefresh.dispatch(context,goAsync(),"launcher:disabled:focus");
  }
}
