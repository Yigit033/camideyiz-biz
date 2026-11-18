package biz.camideyiz.app.widget;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

/**
 * Deliberately small: no permission prompts, no periodic JS runtime, no GPS.
 * getStatus observes installed widget IDs, stored snapshot and scheduled
 * alarm; it never claims pixels were rendered by a foreign launcher process.
 */
public final class CamideyizWidgetBridge extends ReactContextBaseJavaModule {
  CamideyizWidgetBridge(ReactApplicationContext context) {
    super(context);
  }

  @Override
  public String getName() {
    return "CamideyizWidgetBridge";
  }

  @ReactMethod
  public void selectDistrict(int cityId, Promise promise) {
    try {
      promise.resolve(WidgetBoundaryScheduler.selectDistrict(
          getReactApplicationContext(),cityId).toString());
    }catch(Exception error){promise.reject("WIDGET_DISTRICT",error);}
  }

  @ReactMethod
  public void reportTransfer(int cityId,String stage,String detail,Promise promise){
    try {
      promise.resolve(WidgetBoundaryScheduler.transferStage(
          getReactApplicationContext(),cityId,stage,detail).toString());
    }catch(Exception error){promise.reject("WIDGET_TRANSFER_REPORT",error);}
  }

  @ReactMethod
  public void publishCalendar(String json, Promise promise) {
    try {
      promise.resolve(WidgetBoundaryScheduler.publish(
          getReactApplicationContext(), json).toString());
    } catch (Exception error) {
      // Keep the rejection visible even if the next OS onUpdate redraws the
      // existing placeholder and resets routine RemoteViews errors.
      try {
        int active=WidgetBoundaryScheduler.status(getReactApplicationContext())
            .optInt("activeCityId",0);
        WidgetBoundaryScheduler.transferStage(getReactApplicationContext(),active,
            "failed","native publish: "+error.getMessage());
      } catch(Exception ignored){}
      promise.reject("WIDGET_NATIVE_PUBLISH",error);
    }
  }

  @ReactMethod
  public void refreshNow(Promise promise) {
    try {
      ReactApplicationContext context=getReactApplicationContext();
      WidgetBoundaryScheduler.refresh(context,"manual:diagnostic-repair");
      promise.resolve(WidgetBoundaryScheduler.status(context).toString());
    } catch (Exception error) {
      promise.reject("WIDGET_NATIVE_REPAIR", error);
    }
  }

  @ReactMethod
  public void getStatus(Promise promise) {
    try {
      promise.resolve(WidgetBoundaryScheduler.status(
          getReactApplicationContext()).toString());
    } catch (Exception error) {
      promise.reject("WIDGET_NATIVE_STATUS", error);
    }
  }
}
