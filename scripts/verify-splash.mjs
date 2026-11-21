/**
 * Brand splash contracts: native ↔ JS hand-off must be pixel-identical,
 * the mark must survive the Android 12+ circular icon mask, and the opening
 * must never hold the user back. Device QA is still required for timing feel.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import sharp from 'sharp';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFileSync(resolve(root,p),'utf8');

const plugin=JSON.parse(read('apps/mobile/app.json')).expo.plugins
  .find(p=>Array.isArray(p)&&p[0]==='expo-splash-screen')?.[1];
assert.ok(plugin,'expo-splash-screen must be configured in app.json');
const splash=read('apps/mobile/src/features/brand/BrandSplash.tsx');
const layout=read('apps/mobile/src/app/_layout.tsx');

// 1. Native and JS frames are identical (colour, image, size).
assert.equal(plugin.image,'./assets/splash-mark.png');
assert.equal(plugin.dark?.image,plugin.image);
assert.equal(plugin.backgroundColor,'#050A1D');
assert.equal(plugin.dark?.backgroundColor,plugin.backgroundColor);
assert.equal(plugin.resizeMode,'contain');
assert.match(splash,new RegExp("SPLASH_BACKGROUND='"+plugin.backgroundColor+"'"));
assert.match(splash,new RegExp('SPLASH_MARK_WIDTH='+plugin.imageWidth+';'));
assert.match(splash,/require\('\.\.\/\.\.\/\.\.\/assets\/splash-mark\.png'\)/);
assert.match(splash,/mark:\{width:SPLASH_MARK_WIDTH,height:SPLASH_MARK_WIDTH\}/,
  'square contain box reproduces the native icon placement');

// 2. Exact owner-derived artwork, inside the Android 12+ 192dp icon circle.
const png=readFileSync(resolve(root,'apps/mobile/assets/splash-mark.png'));
assert.equal(createHash('sha256').update(png).digest('hex'),
  '50d1a5e6ea4aea9e2459a99b906681ca178b020e3157cb01998d80e7ab08c3bd',
  'splash-mark.png must be the build-splash-mark.mjs derivation of the approved icon');
const {data,info}=await sharp(png).raw().toBuffer({resolveWithObject:true});
assert.equal(info.channels,4);
const scale=plugin.imageWidth/Math.max(info.width,info.height); // dp per px (contain)
let farthest=0;
for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
  if(data[(y*info.width+x)*4+3]<8)continue;
  const dx=(x+0.5-info.width/2)*scale,dy=(y+0.5-info.height/2)*scale;
  farthest=Math.max(farthest,Math.hypot(dx,dy));
}
assert.ok(farthest<=96,'mark reaches '+farthest.toFixed(1)+'dp; Android 12+ clips outside a 96dp radius');
for(const [x,y] of [[0,0],[info.width-1,0],[0,info.height-1],[info.width-1,info.height-1]])
  assert.equal(data[(y*info.width+x)*4+3],0,'transparent corners: no box on the flat field');

// 3. Seamless, bounded, accessible opening.
assert.match(layout,/import \{BrandSplash\} from '@\/features\/brand\/BrandSplash'/);
assert.match(layout,/<Navigation\/>\s*\{\/\*[^*]*\*\/\}\s*<BrandSplash\/>/,
  'overlay must be the last child so Home renders beneath it');
assert.match(splash,/^SplashScreen\.preventAutoHideAsync\(\)/m,'native splash held at module scope');
assert.match(splash,/if\(!imageReady\)return;[\s\S]*?requestAnimationFrame\(\(\)=>\{\s*hideNativeSplash\(\)/,
  'native splash is removed only once the identical JS frame is drawn');
assert.match(splash,/setTimeout\(hideNativeSplash,5000\)/,'render errors must not trap the splash');
const cap=Number(splash.match(/MAX_WAIT_MS=(\d+)/)[1]);
const reveal=Number(splash.match(/REVEAL_MS=(\d+)/)[1]);
assert.ok(cap+reveal<=1700,'opening must finish within 1.7 s even on a slow network');
assert.match(splash,/pointerEvents=\{revealing\?'none':'auto'\}/,'Home is touchable during the reveal');
assert.match(splash,/isReduceMotionEnabled/);
assert.ok((splash.match(/useNativeDriver:true/g)??[]).length>=2,'animations run on the UI thread');
assert.match(splash,/<StatusBar style="light"\/>/);
console.log('Splash: native/JS identical frame, owner-derived mark inside the Android 12 mask ('+
  farthest.toFixed(1)+'dp), bounded '+(cap+reveal)+'ms opening and reduce-motion verified');
