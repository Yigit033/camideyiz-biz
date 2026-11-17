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
  public void publishCalendar(String json, Promise promise) {
    try {
      promise.resolve(WidgetBoundaryScheduler.publish(
          getReactApplicationContext(), json).toString());
    } catch (Exception error) {
      promise.reject("WIDGET_NATIVE_PUBLISH", error);
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
