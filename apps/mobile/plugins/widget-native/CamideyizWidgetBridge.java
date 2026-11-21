package biz.camideyiz.app.widget;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import org.json.JSONObject;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.RejectedExecutionException;

/**
 * React Native methods enqueue onto the serialized native coordinator.
 * Promise signatures remain compatible with all existing JS/native callers.
 * No SharedPreferences.commit(), Canvas, getAppWidgetIds() or AlarmManager call
 * may execute on the React Native native-module invocation queue.
 */
public final class CamideyizWidgetBridge extends ReactContextBaseJavaModule {
  CamideyizWidgetBridge(ReactApplicationContext context){super(context);}
  @Override public String getName(){return "CamideyizWidgetBridge";}
  private static final ExecutorService STATUS=Executors.newSingleThreadExecutor(job->{
    Thread thread=new Thread(job,"CamideyizWidgetStatus");
    thread.setPriority(Thread.NORM_PRIORITY-1);
    return thread;
  });
  private interface Work {void run()throws Exception;}
  private void submit(Promise promise,String code,Work work){
    if(!WidgetBoundaryAsyncRefresh.executeBridge(()->{
      try{work.run();}
      catch(Exception failure){promise.reject(code,failure);}
    }))promise.reject(code,new IllegalStateException("Native widget coordinator unavailable"));
  }

  @ReactMethod
  public void selectDistrict(int cityId, Promise promise){
    submit(promise,"WIDGET_DISTRICT",()->promise.resolve(
        WidgetBoundaryScheduler.selectDistrict(getReactApplicationContext(),cityId).toString()));
  }

  @ReactMethod
  public void reportTransfer(int cityId,String stage,String detail,Promise promise){
    submit(promise,"WIDGET_TRANSFER_REPORT",()->promise.resolve(
        WidgetBoundaryScheduler.transferStage(
            getReactApplicationContext(),cityId,stage,detail).toString()));
  }

  @ReactMethod
  public void publishCalendar(String json,Promise promise){
    submit(promise,"WIDGET_NATIVE_PUBLISH",()->{
      ReactApplicationContext context=getReactApplicationContext();
      try{
        promise.resolve(WidgetBoundaryScheduler.publish(context,json).toString());
      }catch(Exception failure){
        try{
          int active=WidgetBoundaryScheduler.status(context).optInt("activeCityId",0);
          int requested=new JSONObject(json).optInt("cityId",0);
          if(requested>0&&requested==active)
            WidgetBoundaryScheduler.transferStage(context,active,"failed",
                "native publish: "+failure.getMessage());
        }catch(Exception ignored){}
        throw failure;
      }
    });
  }

  @ReactMethod
  public void refreshNow(Promise promise){
    submit(promise,"WIDGET_NATIVE_REPAIR",()->{
      ReactApplicationContext context=getReactApplicationContext();
      WidgetBoundaryScheduler.refresh(context,"manual:diagnostic-repair");
      promise.resolve(WidgetBoundaryScheduler.status(context).toString());
    });
  }

  @ReactMethod
  public void setAppearance(String mode,String resolved,Promise promise){
    submit(promise,"WIDGET_APPEARANCE",()->{
      ReactApplicationContext context=getReactApplicationContext();
      boolean changed=WidgetBoundaryScheduler.setAppearance(context,mode,resolved);
      if(changed)WidgetBoundaryAsyncRefresh.dispatchAppEvent(context,"theme:changed");
      promise.resolve(changed);
    });
  }

  @ReactMethod
  public void getStatus(Promise promise){
    // Status is read-only and must not wait for a calendar publish or bitmap
    // preparation queued on the native coordinator.
    try{
      STATUS.execute(()->{
        try{
          promise.resolve(WidgetBoundaryScheduler.status(
              getReactApplicationContext()).toString());
        }catch(Exception error){promise.reject("WIDGET_NATIVE_STATUS",error);}
      });
    }catch(RejectedExecutionException error){
      promise.reject("WIDGET_NATIVE_STATUS",error);
    }
  }
}
