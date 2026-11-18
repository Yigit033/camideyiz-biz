import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import {hasAndroidNativeWidgetBridge} from '../native/nativeRuntime';

/** Keep this identifier stable across upgrades or WorkManager loses its job. */
export const WIDGET_BACKGROUND_TASK='camideyiz-widget-refresh-v3';

/**
 * Expo requires defineTask synchronously at JS module scope, including on
 * headless launches. Only register this lightweight executor at startup.
 * Network clients, AsyncStorage calendar logic and notification helpers load
 * on demand INSIDE an actual background execution, never before first paint.
 */
if(hasAndroidNativeWidgetBridge()){
  TaskManager.defineTask(WIDGET_BACKGROUND_TASK,async()=>{
    try{
      const {runWidgetBackgroundRefresh}=await import('./widgetBackground');
      const ok=await runWidgetBackgroundRefresh();
      return ok
        ?BackgroundTask.BackgroundTaskResult.Success
        :BackgroundTask.BackgroundTaskResult.Failed;
    }catch{
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}
