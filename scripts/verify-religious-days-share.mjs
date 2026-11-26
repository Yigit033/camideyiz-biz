/**
 * Religious-day share cards (25.11.2026): every row of Dini Günler opens a
 * branded card (camideyiz.biz mark, warm Turkish greeting, Hijri and
 * Gregorian date, Ottoman gold ornament) exported through the SAME pipeline
 * as the Gallery: react-native-view-shot PNG at 1080 px, expo-sharing sheet,
 * write-only save.
 *
 *   node scripts/verify-religious-days-share.mjs
 */
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

const root=resolve(import.meta.dirname,'..');
const r=p=>readFileSync(resolve(root,p),'utf8');

// Node < 23.6 needs the flag to import the TypeScript art and copy modules.
let art,share,days;
try{
  art=await import(pathToFileURL(resolve(root,'apps/mobile/src/features/calendar/religiousDayCardArt.ts')).href);
  share=await import(pathToFileURL(resolve(root,'packages/core/src/religiousDayShare.ts')).href);
  days=await import(pathToFileURL(resolve(root,'packages/core/src/religiousDays.ts')).href);
}catch(error){
  if(process.execArgv.includes('--experimental-strip-types'))throw error;
  const run=spawnSync(process.execPath,['--experimental-strip-types',...process.argv.slice(1)],
    {cwd:root,stdio:'inherit'});
  process.exit(run.status??1);
}

// 1. One export pipeline. Only designExport.ts captures, shares or saves.
const walk=dir=>readdirSync(dir).flatMap(name=>{
  const path=join(dir,name);
  return statSync(path).isDirectory()?walk(path):/\.tsx?$/.test(name)?[path]:[];
});
const pipeline='apps/mobile/src/features/gallery/designExport.ts';
for(const file of walk(resolve(root,'apps/mobile/src'))){
  const rel=relative(root,file).replaceAll('\\','/');
  if(rel===pipeline)continue;
  const src=readFileSync(file,'utf8');
  assert.doesNotMatch(src,/react-native-view-shot|from 'expo-sharing'|expo-media-library/,
    rel+' must export through '+pipeline+', not a parallel pipeline');
}
const exporter=r(pipeline);
assert.match(exporter,/captureRef\(view,\{\s*result:'tmpfile',format:'png',quality:1,\s*width:dims\.width,height:dims\.height,/);
assert.match(exporter,/galleryFormatDimensions\(format\)/);
assert.match(exporter,/Sharing\.shareAsync\(uri,\{\s*mimeType:'image\/png',UTI:'public\.png',/);
assert.match(exporter,/requestPermissionsAsync\(true,\['photo'\]\)/,'saving stays write-only');
const editor=r('apps/mobile/src/app/gallery-editor.tsx');
assert.match(editor,/captureDesignPng\(canvasRef,draft\.format\)/);
assert.match(editor,/shareDesignPng\(imageForExport\)/);
assert.match(editor,/saveDesignPng\(imageForExport\)/);

// 2. A native-looking share button on every religious-day row.
const list=r('apps/mobile/src/app/religious-days.tsx');
const toggle=list.indexOf('accessibilityState={{expanded:active}}');
const push=list.indexOf("router.push({pathname:'/religious-day-share',params:{id:item.id}})");
assert.ok(toggle>0&&push>0,'each row needs a share button that opens its card');
assert.ok(list.slice(toggle,push).includes('</Pressable>'),
  'the share button is a sibling of the row toggle, never nested (TalkBack)');
assert.match(list,/accessibilityLabel=\{item\.title\+' için paylaşım kartı hazırla'\}/);
assert.match(list,/<Feather name="share-2" size=\{17\} color=\{colors\.gold\}\/>/);
assert.match(list,/backgroundColor:pressed\?colors\.elevated:colors\.soft/,'theme tokens, both themes');
assert.match(r('apps/mobile/src/app/_layout.tsx'),/<Stack\.Screen name="religious-day-share"/);

// 3. The share screen: Gallery formats, logo drawn before capture, export at 1080 px.
const screen=r('apps/mobile/src/app/religious-day-share.tsx');
assert.match(screen,/RELIGIOUS_DAYS\.find\(d=>d\.id===id\)/);
assert.match(screen,/\{id:'story',name:'Durum',ratio:'9:16'\}/);
assert.match(screen,/\{id:'post',name:'Gönderi',ratio:'4:5'\}/);
assert.match(screen,/shareDesignPng\(\(\)=>captureDesignPng\(cardRef,format\)\)/);
assert.match(screen,/saveDesignPng\(\(\)=>captureDesignPng\(cardRef,format\)\)/);
assert.match(screen,/canExport=Boolean\(day\)&&loadedTone===tone&&!busy&&scale>0/,
  'no capture before the logo of the visible tone has loaded');
assert.match(screen,/const exportWidth=1080\/PixelRatio\.get\(\);/,
  'the card is laid out at native 1080 px; only the preview is scaled');
assert.match(screen,/transform:\[\{scale\}\]/);
assert.match(screen,/<SafeAreaView edges=\{\['top','bottom'\]\}/);

// 4. The card: transparent brand marks, fixed type, every text from the data.
const card=r('apps/mobile/src/features/calendar/ReligiousDayCard.tsx');
assert.match(card,/dark:require\('\.\.\/\.\.\/\.\.\/assets\/widget-mark-dark\.png'\)/);
assert.match(card,/light:require\('\.\.\/\.\.\/\.\.\/assets\/widget-mark-light\.png'\)/);
const logo=card.slice(card.indexOf('<Image key={palette.logo}'));
assert.ok(logo.length>0&&!/backgroundColor|borderRadius|borderWidth/.test(logo.slice(0,logo.indexOf('/>'))),
  'the logo sits on the card with no box behind it');
const texts=card.match(/<Text /g)?.length??0;
assert.equal((card.match(/<Text allowFontScaling=\{false\}/g)??[]).length,texts,
  'exported text must not follow the phone font size');
for(const field of ['copy.eyebrow','copy.hijri','copy.gregorian','copy.blessing','lines.join','fitHeadline(copy.headline,headlineBox(layout))'])
  assert.ok(card.includes(field),'card misses '+field);
assert.match(card,/collapsable=\{false\}/);
const require=createRequire(import.meta.url);
const sharp=require('sharp');
for(const name of ['widget-mark-dark.png','widget-mark-light.png']){
  const {data,info}=await sharp(resolve(root,'apps/mobile/assets',name)).ensureAlpha().raw()
    .toBuffer({resolveWithObject:true});
  assert.equal(info.width/info.height,art.LOGO_ASPECT,name+' aspect changed');
  for(const [x,y] of [[0,0],[info.width-1,0],[0,info.height-1],[info.width-1,info.height-1]])
    assert.equal(data[(y*info.width+x)*4+3],0,name+' must stay transparent (no square box)');
}

// 5. Artwork: Gallery ratios, brand palette, safe zones, readable headlines.
const story=art.cardLayout('story'),post=art.cardLayout('post');
assert.equal(story.height/story.width,16/9);
assert.equal(post.height/post.width,5/4);
const toRgb=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255);
const hue=c=>{const [R,G,B]=toRgb(c);const max=Math.max(R,G,B),d=max-Math.min(R,G,B);
  if(!d)return -1;let h=max===R?((G-B)/d)%6:max===G?(B-R)/d+2:(R-G)/d+4;h*=60;return h<0?h+360:h;};
for(const [key,value] of Object.entries(art.CARD_PALETTE.night))
  if(typeof value==='string'&&value.startsWith('#')){
    const h=hue(value);
    assert.ok(h<85||h>175,'night card colour '+key+' '+value+' must be blue, cyan or gold');
  }
assert.equal(art.CARD_PALETTE.night.logo,'dark');
assert.equal(art.CARD_PALETTE.ivory.logo,'light');
// WhatsApp Durum chrome covers ~10% top and ~9% bottom: words and logo stay inside.
assert.ok(story.motif.cy-30>story.height*.1&&story.eyebrow.top>story.height*.1);
assert.ok(story.logo.top+story.logo.height<story.height*.91);
for(const L of [story,post]){
  assert.ok(L.arch.apex<L.motif.cy-25&&L.headline.top+L.headline.height<=L.divider-8);
  assert.ok(L.blessing.top+L.blessing.height<L.arch.base&&L.arch.base+8<L.logo.top);
  assert.ok(L.logo.top+L.logo.height<L.height-L.frame-6,'logo inside the frame');
  assert.ok(L.arch.spring-L.arch.apex>=(L.arch.right-L.arch.left)/2,'pointed arch, never notched');
}
for(const format of ['story','post'])for(const tone of ['night','ivory'])
  for(const motif of ['lamp','crescent','star']){
    const a=art.cardArt(format,tone,motif);
    assert.ok(a.shapes.length>30);
    for(const s of a.shapes)assert.doesNotMatch(s.d,/NaN|undefined|Infinity/,format+'/'+tone+'/'+motif);
  }
for(const day of days.RELIGIOUS_DAYS){
  const copy=share.religiousDayShareCopy(day);
  for(const L of [story,post]){
    const fit=share.fitHeadline(copy.headline,art.headlineBox(L));
    assert.ok(fit.fontSize>=L.headline.minFont,'headline too small: '+copy.headline);
    const last=fit.lines.at(-1);
    assert.ok(fit.lines.length===1||last.includes(' ')||last.length>6,
      'no short orphan on the last line: '+fit.lines.join(' / '));
  }
}
const uc=days.RELIGIOUS_DAYS.find(d=>d.title==='Üç Ayların Başlangıcı');
assert.equal(share.religiousDayShareCopy(uc).headline,'Üç Aylar başlıyor');

console.log('Religious-day share cards: one Gallery export pipeline, a share button per row, '+
  'transparent brand mark, 9:16 + 4:5 Ottoman gold cards for '+days.RELIGIOUS_DAYS.length+' days OK');
