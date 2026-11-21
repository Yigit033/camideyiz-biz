// Android fused, tilt-aware Qibla compass (TYPE_ROTATION_VECTOR).
// Expo CNG plugin: copies the module and registers it in MainApplication.
// No manifest permission is needed for these sensors.
const {withDangerousMod,withMainApplication}=require('expo/config-plugins');
const fs=require('node:fs/promises');
const path=require('node:path');

const PACKAGE='biz.camideyiz.app.compass';
const FILES=['CamideyizCompassModule.java','CamideyizCompassPackage.java'];

function withCompassRegistration(config){
  return withMainApplication(config,cfg=>{
    let next=cfg.modResults.contents;
    const imp='import '+PACKAGE+'.CamideyizCompassPackage';
    if(!next.includes(imp))
      next=next.replace(/^(package\s+[^\r\n]+\r?\n)/m,'$1\n'+imp+'\n');
    const needle='PackageList(this).packages.apply {';
    if(!next.includes('add(CamideyizCompassPackage())')){
      if(!next.includes(needle))throw Error('Cannot locate React Native package registration');
      next=next.replace(needle,needle+'\n          add(CamideyizCompassPackage())');
    }
    cfg.modResults.contents=next;
    return cfg;
  });
}

function withCompassSources(config){
  return withDangerousMod(config,['android',async cfg=>{
    const target=path.join(cfg.modRequest.platformProjectRoot,'app','src','main',
      'java','biz','camideyiz','app','compass');
    await fs.mkdir(target,{recursive:true});
    for(const name of FILES)
      await fs.copyFile(path.join(__dirname,'compass-native',name),path.join(target,name));
    return cfg;
  }]);
}

module.exports=function withNativeCompass(config){
  return withCompassSources(withCompassRegistration(config));
};
