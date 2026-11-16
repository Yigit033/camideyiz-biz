/** Share Gallery 2.0 has no user accounts, social feed or server uploads.
 * Only owner-approved, bundled photographs can be published to the catalogue.
 */
export const GALLERY_TEXT_MAX_LENGTH=160;
export type GalleryCategory='cuma'|'dua'|'kandil'|'ramazan'|'bayram'|'gunaydin'|'genel';
export type GalleryFormat='story'|'post';
export type GalleryPhotoFit='contain'|'cover';
/** Exact same framing math is shared by on-screen preview and export capture.
 * Full mode reserves deliberate breathing room around an uncropped image.
 * Fill mode is edge-to-edge and may crop the source by aspect ratio.
 */
export function galleryPhotoFraming(fit:GalleryPhotoFit){
  if(fit==='contain')return {
    horizontalInset:.045,verticalInset:.065,resizeMode:'contain' as const,
  };
  if(fit==='cover')return {
    horizontalInset:0,verticalInset:0,resizeMode:'cover' as const,
  };
  throw new RangeError('Unknown gallery framing mode');
}

export type GalleryFont='serif'|'modern'|'handwriting'|'condensed';
export type GalleryTextPosition='top'|'center'|'bottom';
export type GalleryTextTone='ivory'|'white'|'gold'|'dark';

export const GALLERY_CATEGORIES=[
  {id:'all',label:'Tümü'},
  {id:'cuma',label:'Cuma'},
  {id:'dua',label:'Dua'},
  {id:'kandil',label:'Kandil'},
  {id:'ramazan',label:'Ramazan'},
  {id:'bayram',label:'Bayram'},
  {id:'gunaydin',label:'Günlük'},
  {id:'genel',label:'Diğer'},
] as const;

export const GALLERY_PRESETS=[
  {id:'cuma-1',category:'cuma',text:'Hayırlı Cumalar'},
  {id:'cuma-2',category:'cuma',text:'Cumanız mübarek olsun. Dualarınız kabul olsun.'},
  {id:'cuma-3',category:'cuma',text:'Huzur, sağlık ve bereket dolu bir cuma diliyorum.'},
  {id:'dua-1',category:'dua',text:'Rabbim gönlünüzden geçen hayırlı duaları kabul etsin.'},
  {id:'dua-2',category:'dua',text:'Huzur ve bereket gönlünüzden eksik olmasın.'},
  {id:'kandil-1',category:'kandil',text:'Kandiliniz mübarek olsun.'},
  {id:'kandil-2',category:'kandil',text:'Bu mübarek gecenin hayırlara vesile olmasını dilerim.'},
  {id:'ramazan-1',category:'ramazan',text:'Hayırlı Ramazanlar'},
  {id:'ramazan-2',category:'ramazan',text:'Ramazan ayınız bereketli olsun.'},
  {id:'bayram-1',category:'bayram',text:'Bayramınız mübarek olsun.'},
  {id:'bayram-2',category:'bayram',text:'Sevdiklerinizle huzurlu ve güzel bir bayram dilerim.'},
  {id:'gunaydin-1',category:'gunaydin',text:'Hayırlı Sabahlar'},
  {id:'gunaydin-2',category:'gunaydin',text:'Hayırlı Akşamlar'},
  {id:'genel-1',category:'genel',text:'Güzellikler ve hayırlar sizinle olsun.'},
] as const;

export function cleanGalleryText(input:string):string{
  return input.replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'')
    .slice(0,GALLERY_TEXT_MAX_LENGTH);
}
export function canExportGalleryDesign(hasOwnerPhoto:boolean,text:string):boolean{
  return hasOwnerPhoto&&cleanGalleryText(text).trim().length>0;
}
export function galleryFormatDimensions(format:GalleryFormat):{width:number;height:number}{
  return format==='story'?{width:1080,height:1920}:{width:1080,height:1350};
}
export function galleryTextRelativeTop(position:GalleryTextPosition):number{
  // Keep captions inside the safe visual band of WhatsApp Story chrome.
  return position==='top'?0.27:position==='center'?0.5:0.73;
}
/** Large text is premium for greetings; longer personal messages must fit
 * without silently dropping their final lines from the output image.
 */
export function galleryTextFitScale(text:string):number{
  const len=Array.from(text).length;
  return len>130?.48:len>95?.62:len>60?.8:1;
}
export type GalleryTextSize='small'|'normal'|'large';
export type GalleryShade='light'|'medium'|'deep';
export type GalleryDraft={
  text:string;font:GalleryFont;position:GalleryTextPosition;tone:GalleryTextTone;
  format:GalleryFormat;textSize:GalleryTextSize;shade:GalleryShade;
  photoFit:GalleryPhotoFit;
};
export const DEFAULT_GALLERY_DRAFT:GalleryDraft={
  text:'Hayırlı Cumalar',font:'serif',position:'center',tone:'ivory',format:'story',
  textSize:'normal',shade:'medium',photoFit:'contain',
};
export function parseGalleryDraft(value:unknown):GalleryDraft|null{
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const d=value as Partial<GalleryDraft>;
  if(typeof d.text!=='string'||d.text.length>GALLERY_TEXT_MAX_LENGTH*3||
    !(['serif','modern','handwriting','condensed'] as unknown[]).includes(d.font)||
    !(['top','center','bottom'] as unknown[]).includes(d.position)||
    !(['ivory','white','gold','dark'] as unknown[]).includes(d.tone)||
    !(['story','post'] as unknown[]).includes(d.format)||
    !(['small','normal','large'] as unknown[]).includes(d.textSize)||
    !(['light','medium','deep'] as unknown[]).includes(d.shade)||
    (d.photoFit!==undefined&&!(['contain','cover'] as unknown[]).includes(d.photoFit)))return null;
  return {text:cleanGalleryText(d.text),font:d.font!,position:d.position!,
    tone:d.tone!,format:d.format!,textSize:d.textSize!,shade:d.shade!,
    photoFit:d.photoFit??'contain'};
}
