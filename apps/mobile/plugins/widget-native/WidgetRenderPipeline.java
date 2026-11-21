package biz.camideyiz.app.widget;

import android.content.Context;
import android.graphics.Bitmap;
import android.os.SystemClock;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.RejectedExecutionException;

/**
 * Widget Engine 4.1: three distinct phases.
 * 1. The existing coordinator validates and persists published times.
 * 2. Bounded renderer prepares ONLY dirty circular bitmaps.
 * 3. Bounded dispatcher builds RemoteViews and sends changed widget families.
 *
 * No main/RN-module thread is blocked waiting for either worker. Both queues
 * are intentionally bounded; stale generations never overwrite new districts.
 *
 * Engine 4.3 latest-wins back-pressure: the coordinator enqueues strictly
 * increasing generations, so the head of a full queue is always the stalest
 * frame (it would be dropped by the generation check anyway). It is evicted
 * and its goAsync completion runs immediately; NEW work is never rejected.
 * Families of an evicted frame stay dirty against their persisted signature,
 * so the surviving newer generation repaints them.
 */
final class WidgetRenderPipeline {
  private static final String TAG="CamideyizWidgetRender";

  /** Queued unit whose completion callback MUST run exactly once. */
  private static final class Job implements Runnable{
    private final Runnable work,completed;
    Job(Runnable work,Runnable completed){this.work=work;this.completed=completed;}
    @Override public void run(){work.run();}
    void evict(){
      evictedStaleJobs++;
      complete(completed);
    }
  }
  private static ThreadPoolExecutor pool(String name){
    return new ThreadPoolExecutor(1,1,0L,TimeUnit.MILLISECONDS,
      new LinkedBlockingQueue<Runnable>(3),job->{
        Thread thread=new Thread(job,name);
        thread.setPriority(Thread.NORM_PRIORITY-1);
        return thread;
      },(job,executor)->{
        if(executor.isShutdown())
          throw new RejectedExecutionException("widget pipeline shut down");
        Runnable oldest=executor.getQueue().poll();
        if(oldest instanceof Job)((Job)oldest).evict();
        if(!executor.getQueue().offer(job))
          throw new RejectedExecutionException("widget pipeline saturated");
      });
  }
  private static final ThreadPoolExecutor RENDER=pool("CamideyizBitmapRender");
  private static final ThreadPoolExecutor DISPATCH=pool("CamideyizRemoteViewsDispatch");
  private static volatile long lastRenderWaitMs=0;
  private static volatile long lastDispatchWaitMs=0;
  private static volatile long skippedStaleGenerations=0;
  private static volatile long rejectedRenderJobs=0;
  private static volatile long evictedStaleJobs=0;
  private WidgetRenderPipeline(){}

  static void enqueue(Context context, JSONObject snapshot,int[][] installed,
      boolean[] dirty,String[] familyKeys,String signature,long generation,
      Runnable completed){
    final Context app=context.getApplicationContext();
    final long queued=SystemClock.elapsedRealtime();
    try {
      RENDER.execute(new Job(()->{
        lastRenderWaitMs=SystemClock.elapsedRealtime()-queued;
        if(!WidgetBoundaryScheduler.isCurrentGeneration(generation)){
          skippedStaleGenerations++;
          complete(completed);
          return;
        }
        final Bitmap[] frames=new Bitmap[2];
        try{
          JSONArray times=snapshot.optBoolean("ready",false)
              ?snapshot.getJSONArray("times"):new JSONArray();
          long now=System.currentTimeMillis();
          // Theme-neutral ring art: one cached bitmap serves light, dark and
          // launcher-resolved day/night layouts alike.
          if((dirty[5]&&installed[5].length>0)||
              (dirty[8]&&installed[8].length>0))
            frames[0]=PrayerRingBitmapRenderer.render(times,now,224);
          if(dirty[6]&&installed[6].length>0)
            frames[1]=PrayerRingBitmapRenderer.render(times,now,432);
        }catch(Exception failure){
          WidgetBoundaryScheduler.renderFailed(app,generation,failure);
          complete(completed);
          return;
        }
        final long dispatchQueued=SystemClock.elapsedRealtime();
        try{
          DISPATCH.execute(new Job(()->{
            lastDispatchWaitMs=SystemClock.elapsedRealtime()-dispatchQueued;
            try{
              if(!WidgetBoundaryScheduler.isCurrentGeneration(generation)){
                skippedStaleGenerations++;
                return;
              }
              long renderAt=SystemClock.elapsedRealtime();
              int dispatched=WidgetBoundaryScheduler.renderWidgets(
                  app,snapshot,installed,dirty,frames,generation);
              long renderMs=SystemClock.elapsedRealtime()-renderAt;
              WidgetBoundaryScheduler.renderFinished(app,generation,
                  familyKeys,signature,dispatched,renderMs);
            }catch(Exception failure){
              WidgetBoundaryScheduler.renderFailed(app,generation,failure);
            }finally{complete(completed);}
          },completed));
        }catch(RejectedExecutionException failure){
          rejectedRenderJobs++;
          WidgetBoundaryScheduler.renderFailed(app,generation,failure);
          complete(completed);
        }
      },completed));
    }catch(RejectedExecutionException failure){
      rejectedRenderJobs++;
      WidgetBoundaryScheduler.renderFailed(app,generation,failure);
      complete(completed);
    }
  }

  private static void complete(Runnable callback){
    if(callback==null)return;
    try{callback.run();}
    catch(RuntimeException e){Log.w(TAG,"Native render callback failed",e);}
  }

  static void appendMetrics(JSONObject out)throws org.json.JSONException{
    out.put("nativeRenderQueueWaitMs",lastRenderWaitMs);
    out.put("nativeDispatchQueueWaitMs",lastDispatchWaitMs);
    out.put("nativeStaleRenderDrops",skippedStaleGenerations);
    out.put("nativeRenderQueueRejected",rejectedRenderJobs);
    out.put("nativeRenderQueueEvicted",evictedStaleJobs);
    out.put("nativeRenderQueueDepth",RENDER.getQueue().size());
    out.put("nativeDispatchQueueDepth",DISPATCH.getQueue().size());
  }
}
