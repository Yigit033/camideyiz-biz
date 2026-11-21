import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import {AppState} from 'react-native';
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
      // A due periodic worker must not compete with a user opening Home.
      // Native alarm/RemoteViews continues functioning without JS.
      if(AppState.currentState==='active')
        return BackgroundTask.BackgroundTaskResult.Success;
      // Native alarm and launcher countdown already own the current prayer.
      // Avoid loading the large JS calendar engine for a healthy 2h window.
      const {canSkipWidgetHeadlessRefresh}=await import('./widgetHeadlessHealthGate');
      if(await canSkipWidgetHeadlessRefresh())
        return BackgroundTask.BackgroundTaskResult.Success;
      if(AppState.currentState==='active')
        return BackgroundTask.BackgroundTaskResult.Success;
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
