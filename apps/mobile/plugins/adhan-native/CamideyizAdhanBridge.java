package biz.camideyiz.app.adhan;

import android.content.Intent;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

/** Explicit native opt-in, read/write via a small React Native Java bridge. */
public final class CamideyizAdhanBridge extends ReactContextBaseJavaModule {
  public CamideyizAdhanBridge(ReactApplicationContext context){super(context);}
  @Override public String getName(){return "CamideyizAdhanBridge";}

  @ReactMethod public void getStatus(Promise promise){
    try{promise.resolve(AdhanAlarmScheduler.status(getReactApplicationContext()).toString());}
    catch(Exception error){promise.reject("ADHAN_STATUS",error);}
  }
  @ReactMethod public void requestExactAlarmPermission(Promise promise){
    try{
      AdhanAlarmScheduler.openPermissionSettings(getReactApplicationContext());
      promise.resolve(true);
    }catch(Exception error){promise.reject("ADHAN_PERMISSION",error);}
  }
  @ReactMethod public void syncAlarms(String json, Promise promise){
    try{promise.resolve(AdhanAlarmScheduler.replace(getReactApplicationContext(),json).toString());}
    catch(Exception error){promise.reject("ADHAN_SYNC",error);}
  }
  @ReactMethod public void clearAlarms(Promise promise){
    try{
      ReactApplicationContext context=getReactApplicationContext();
      AdhanAlarmScheduler.clear(context);
      context.stopService(new Intent(context,AdhanPlaybackService.class));
      promise.resolve(true);
    }catch(Exception error){promise.reject("ADHAN_CLEAR",error);}
  }
  @ReactMethod public void openAppSettings(Promise promise){
    try{
      AdhanAlarmScheduler.openSettings(getReactApplicationContext(),"app");
      promise.resolve(true);
    }catch(Exception error){promise.reject("ADHAN_SETTINGS",error);}
  }
  /** One tap from an ezan blocker row to the system screen that fixes it:
   * exact | notifications | battery | background | sound | dnd. */
  @ReactMethod public void openSettings(String kind,Promise promise){
    try{
      AdhanAlarmScheduler.openSettings(getReactApplicationContext(),kind==null?"":kind);
      promise.resolve(true);
    }catch(Exception error){promise.reject("ADHAN_SETTINGS",error);}
  }
  /** In-app "Durdur" for a playing ezan or test (same as the notification's
   * stop action: the prayer record is kept). */
  @ReactMethod public void stopEzan(Promise promise){
    try{
      ReactApplicationContext context=getReactApplicationContext();
      context.stopService(new Intent(context,AdhanPlaybackService.class));
      promise.resolve(true);
    }catch(Exception error){promise.reject("ADHAN_STOP",error);}
  }
  @ReactMethod public void raiseAlarmVolume(Promise promise){
    try{promise.resolve(AdhanAlarmScheduler.raiseAlarmVolume(getReactApplicationContext()));}
    catch(Exception error){promise.reject("ADHAN_VOLUME",error);}
  }
  @ReactMethod public void testEzan(Promise promise){
    try{
      AdhanAlarmScheduler.scheduleTest(getReactApplicationContext());
      promise.resolve(true);
    }catch(Exception error){promise.reject("ADHAN_TEST",error);}
  }
}
