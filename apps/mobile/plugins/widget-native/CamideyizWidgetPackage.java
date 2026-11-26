package biz.camideyiz.app.widget;

import androidx.annotation.NonNull;
import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.Collections;
import java.util.List;

/** Registered in generated MainApplication.kt by the idempotent config plugin. */
public final class CamideyizWidgetPackage implements ReactPackage {
  @NonNull
  @Override
  public List<NativeModule> createNativeModules(
      @NonNull ReactApplicationContext context) {
    return Collections.<NativeModule>singletonList(new CamideyizWidgetBridge(context));
  }

  @NonNull
  @Override
  public List<ViewManager> createViewManagers(
      @NonNull ReactApplicationContext context) {
    return Collections.emptyList();
  }
}
