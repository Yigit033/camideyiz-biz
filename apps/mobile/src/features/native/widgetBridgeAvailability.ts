/**
 * Whether the *installed app process* contains the actual compiled Android
 * RemoteViews bridge. Expo appOwnership/expoGoConfig describe a development
 * runtime and can be misleading in customized standalone/dev builds.
 * Capability, not an app label, is the source of truth for widgets.
 */
export function widgetBridgeAvailable(
  platform:string,
  module:unknown,
):boolean{
  if(platform!=='android'||module===null||typeof module!=='object')return false;
  const methods=module as Record<string,unknown>;
  return typeof methods.getStatus==='function'&&
    typeof methods.publishCalendar==='function'&&
    typeof methods.selectDistrict==='function'&&
    typeof methods.refreshNow==='function';
}
