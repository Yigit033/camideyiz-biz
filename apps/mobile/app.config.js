// Expo native icon configuration. Generated assets are imported from the
// owner's EXACT approved screenshot, never recreated by generative imaging.
// Both files must exist together. Unbranded CI/prebuild remains possible,
// but the Windows Release script REQUIRES the approved pair.
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const base=require('./app.json').expo;
const icons=[
  {file:'app-icon.png',sha:'54f731ab37e8a205dcba9c5b7c602d140a8fadbfc69851533482fe9935580f29'},
  {file:'adaptive-icon.png',sha:'b5d7097d0fdbc10319d9f9ae96acd57553e2364e1fd27f9a74e74efc5351c8b2'},
];
const exists=icons.map(x=>fs.existsSync(path.join(__dirname,'assets',x.file)));
if(exists.some(Boolean) && !exists.every(Boolean))
  throw new Error('App icon assets are incomplete. Install both app-icon.png and adaptive-icon.png.');
if(exists.every(Boolean)){
  for(const icon of icons){
    const digest=createHash('sha256').update(
      fs.readFileSync(path.join(__dirname,'assets',icon.file))
    ).digest('hex');
    if(digest!==icon.sha)throw new Error('Approved app icon checksum mismatch: '+icon.file);
  }
  base.icon='./assets/app-icon.png';
  base.android={
    ...base.android,
    icon:'./assets/app-icon.png',
    adaptiveIcon:{
      foregroundImage:'./assets/adaptive-icon.png',
      backgroundColor:'#050A1D',
    },
  };
  base.ios={...base.ios,icon:'./assets/app-icon.png'};
}else if(process.env.CAMIDEYIZ_BRANDED_RELEASE==='1'){
  throw new Error('Approved app icon missing; extract camideyiz-icon-assets.zip into apps/mobile/assets before release.');
}
module.exports={expo:base};
