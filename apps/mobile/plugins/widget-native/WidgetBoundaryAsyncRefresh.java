package biz.camideyiz.app.widget;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.os.SystemClock;
import android.util.Log;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Widget Engine 4.0 native coordinator:
 * - one serialized writer for district/calendar/alarm ordering;
 * - bridge calls NEVER execute disk/JSON/RemoteViews on RN native module queue;
 * - coalesced launcher broadcasts, with finish() for every goAsync result;
 * - no network, React runtime, per-widget thread, or unbounded timer loop.
 *
 * React native publishing and OS widget updates share the same authority.
 * A renderer per widget would race district updates and multiply bitmap work.
 */
public final class WidgetBoundaryAsyncRefresh {
  private static final String TAG="CamideyizWidgetEngine4";
  private static final long DEBOUNCE_MS=75;
  private static final Object GATE=new Object();
  private static final ScheduledThreadPoolExecutor WORKER=
      new ScheduledThreadPoolExecutor(1,task->{
        Thread thread=new Thread(task,"CamideyizWidgetCoordinator");
        thread.setPriority(Thread.NORM_PRIORITY-1);
        return thread;
      });
  static {WORKER.setRemoveOnCancelPolicy(true);}

  private static final ArrayList<BroadcastReceiver.PendingResult> PENDING=
      new ArrayList<>();
  private static boolean refreshScheduled=false;
  private static String latestReason="";
  private static long batchQueuedAt=0;
  private static final AtomicLong mergedEvents=new AtomicLong();
  private static final AtomicLong refreshBatches=new AtomicLong();
  private static final AtomicLong bridgeCalls=new AtomicLong();
  private static volatile long lastQueueWaitMs=0;
  private static volatile long lastBatchMs=0;
  private static volatile long maxBatchMs=0;
  private static volatile int lastBatchSize=0;
  private static volatile long lastBridgeQueueWaitMs=0;

  private WidgetBoundaryAsyncRefresh(){}

  /** Run a ReactMethod on our dedicated worker, not RN's native module thread.
   * This method only enqueues a short task; never wait synchronously for result.
   */
  public static boolean executeBridge(Runnable action){
    final long queued=SystemClock.elapsedRealtime();
    try{
      WORKER.execute(()->{
        lastBridgeQueueWaitMs=SystemClock.elapsedRealtime()-queued;
        bridgeCalls.incrementAndGet();
        try{action.run();}
        catch(Throwable failure){Log.e(TAG,"Uncaught native bridge task",failure);}
      });
      return true;
    }catch(RejectedExecutionException failure){
      Log.e(TAG,"Widget native coordinator rejected a bridge task",failure);
      return false;
    }
  }

  /** App appearance events do not have a broadcast PendingResult. */
  public static void dispatchAppEvent(Context context,String reason){
    enqueueRefresh(context,null,reason);
  }

  /** Every onReceive()/onUpdate() caller has already invoked goAsync().
   * PendingResults must be finished on successful and failed batches alike.
   */
  public static void dispatch(Context context,
      BroadcastReceiver.PendingResult pending,String reason){
    enqueueRefresh(context,pending,reason);
  }

  private static void enqueueRefresh(Context context,
      BroadcastReceiver.PendingResult pending,String reason){
    final Context app=context.getApplicationContext();
    synchronized(GATE){
      if(pending!=null)PENDING.add(pending);
      if(refreshScheduled){
        mergedEvents.incrementAndGet();
        // Preserve a reboot/time-change reason, which requires alarm rearming.
        if(needsAlarmRearm(reason))latestReason=reason;
        return;
      }
      refreshScheduled=true;
      latestReason=reason;
      batchQueuedAt=SystemClock.elapsedRealtime();
      try{
        WORKER.schedule(()->performBatch(app),DEBOUNCE_MS,TimeUnit.MILLISECONDS);
      }catch(RejectedExecutionException failure){
        refreshScheduled=false;
        for(BroadcastReceiver.PendingResult item:PENDING)safeFinish(item);
        PENDING.clear();
        Log.e(TAG,"Widget broadcast refresh scheduling failed",failure);
      }
    }
  }

  private static boolean needsAlarmRearm(String reason){
    return reason.contains("BOOT_COMPLETED")||reason.contains("TIME_SET")||
        reason.contains("TIMEZONE_CHANGED")||reason.contains("MY_PACKAGE_REPLACED");
  }

  private static void performBatch(Context app){
    final ArrayList<BroadcastReceiver.PendingResult> pending;
    final String reason;
    final long queuedAt;
    synchronized(GATE){
      pending=new ArrayList<>(PENDING);
      PENDING.clear();
      reason=latestReason;
      queuedAt=batchQueuedAt;
      // Future broadcasts now enter one new coalesced batch, never this one.
      refreshScheduled=false;
    }
    long started=SystemClock.elapsedRealtime();
    lastQueueWaitMs=Math.max(0,started-queuedAt);
    lastBatchSize=pending.size();
    refreshBatches.incrementAndGet();
    try{
      WidgetBoundaryScheduler.refresh(app,reason);
    }catch(Throwable failure){
      Log.e(TAG,"Native widget refresh failed: "+reason,failure);
    }finally{
      long elapsed=SystemClock.elapsedRealtime()-started;
      lastBatchMs=elapsed;
      maxBatchMs=Math.max(maxBatchMs,elapsed);
      if(elapsed>2000)Log.w(TAG,"Slow native widget batch "+elapsed+"ms, reason="+reason);
      for(BroadcastReceiver.PendingResult item:pending)safeFinish(item);
    }
  }

  private static void safeFinish(BroadcastReceiver.PendingResult pending){
    try{pending.finish();}
    catch(RuntimeException error){Log.w(TAG,"Pending widget broadcast already finished",error);}
  }

  /** Read-only, process-local native performance diagnostics; no PII or IO. */
  public static void appendMetrics(JSONObject output)throws JSONException{
    output.put("engineVersion",4);
    output.put("nativeQueueWaitMs",lastQueueWaitMs);
    output.put("nativeBridgeQueueWaitMs",lastBridgeQueueWaitMs);
    output.put("nativeBatchMs",lastBatchMs);
    output.put("nativeMaxBatchMs",maxBatchMs);
    output.put("nativeLastBatchSize",lastBatchSize);
    output.put("nativeCoalescedEvents",mergedEvents.get());
    output.put("nativeRefreshBatches",refreshBatches.get());
    output.put("nativeBridgeCalls",bridgeCalls.get());
  }
}
