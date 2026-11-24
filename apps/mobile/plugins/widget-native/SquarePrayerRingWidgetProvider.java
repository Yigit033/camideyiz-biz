package biz.camideyiz.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;
import biz.camideyiz.app.widget.WidgetBoundaryAsyncRefresh;

/** A dedicated fixed-grid 2×2 prayer ring. No timers or network in receiver. */
public final class SquarePrayerRingWidgetProvider extends AppWidgetProvider {
  @Override public void onUpdate(Context context,AppWidgetManager manager,int[] ids){
    WidgetBoundaryAsyncRefresh.dispatch(context,goAsync(),"launcher:update:ring:square");
  }
  @Override public void onEnabled(Context context){
    WidgetBoundaryAsyncRefresh.dispatchAppEvent(context,"launcher:enabled:ring:square");
  }
  /** Resizes change the exact-square ring frame (Android 12+ sizes). */
  @Override public void onAppWidgetOptionsChanged(Context context,AppWidgetManager manager,
      int id,Bundle options){
    WidgetBoundaryAsyncRefresh.dispatch(context,goAsync(),"launcher:update:ring:square");
  }
  @Override public void onDisabled(Context context){
    WidgetBoundaryAsyncRefresh.dispatch(context,goAsync(),"launcher:disabled:ring:square");
  }
}
