package biz.camideyiz.app.widget;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.util.Log;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;

/**
 * BroadcastReceiver.onReceive() and AppWidgetProvider.onUpdate() normally run
 * on Android's main thread. Do not parse a multi-day calendar, commit disk
 * state, dispatch RemoteViews or manage AlarmManager on that thread.
 *
 * goAsync() keeps each short broadcast alive until finish(). This is NOT a
 * mechanism for long-running work: network and React must never be added here.
 * Serialized native updates avoid two launcher/system events racing each other.
 */
public final class WidgetBoundaryAsyncRefresh {
  private static final String TAG = "CamideyizWidgetAsync";
  private static final ExecutorService WORKER = Executors.newSingleThreadExecutor(task -> {
    Thread thread = new Thread(task,"CamideyizWidgetRefresh");
    thread.setPriority(Thread.NORM_PRIORITY - 1);
    return thread;
  });

  private WidgetBoundaryAsyncRefresh() {}

  public static void dispatch(Context context,
      BroadcastReceiver.PendingResult pending,String reason) {
    final Context app=context.getApplicationContext();
    try {
      WORKER.execute(() -> {
        try {
          WidgetBoundaryScheduler.refresh(app,reason);
        } catch (Exception error) {
          Log.e(TAG,"Widget refresh failed: "+reason,error);
        } finally {
          // Omitting this causes a broadcast timeout/ANR despite offloading.
          pending.finish();
        }
      });
    } catch (RejectedExecutionException error) {
      pending.finish();
      Log.e(TAG,"Cannot schedule widget refresh: "+reason,error);
    }
  }
}
