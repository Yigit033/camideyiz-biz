package biz.camideyiz.app.compass;

import androidx.annotation.NonNull;
import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.Collections;
import java.util.List;

/** Registered in generated MainApplication.kt by withNativeCompass.js. */
public final class CamideyizCompassPackage implements ReactPackage {
  @NonNull @Override
  public List<NativeModule> createNativeModules(@NonNull ReactApplicationContext context){
    return Collections.<NativeModule>singletonList(new CamideyizCompassModule(context));
  }
  @NonNull @Override
  public List<ViewManager> createViewManagers(@NonNull ReactApplicationContext context){
    return Collections.emptyList();
  }
}
