import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const asset=readFileSync(new URL('../apps/mobile/assets/camideyiz-original-symbol.png',import.meta.url));
const component=readFileSync(
  new URL('../apps/mobile/src/components/CamideyizBrandLogo.tsx',import.meta.url),'utf8');
const header=readFileSync(
  new URL('../apps/mobile/src/features/prayer/HomeBrandHeader.tsx',import.meta.url),'utf8');

// Freeze the user's supplied mark: do not inadvertently replace it with a
// generated approximation, alter the blue dimensional gradient, or put the
// solid black screenshot background back into the application's home header.
const expectedSha256='99f63639d967a0a2650d8ddc07dfef5b63e85a1e7bedf83755b3382e95c2a050';
assert.equal(createHash('sha256').update(asset).digest('hex'),expectedSha256,
  'Owner-supplied brand symbol has changed: require explicit user approval');
assert.equal(asset.subarray(0,8).toString('hex'),'89504e470d0a1a0a',
  'Brand symbol must remain a PNG');
assert.equal(asset.readUInt32BE(16),220);
assert.equal(asset.readUInt32BE(20),138);
assert.equal(asset.toString('latin1',12,16),'IHDR');
// The home header shows the glossy stacked mark: pixel derivations of the
// approved icon (splash-mark.png is hash-locked by verify-splash.mjs; its
// clean dark and deep-azure light derivations widget-mark-{dark,light}.png are
// checked by build-widget-marks.mjs --check). Shown as images, never redrawn
// as vectors. The splash mark itself keeps faint #050A1D field pixels that
// read as a box on the lighter header, so the header never uses it.
assert.match(component,/dark:require\('\.\.\/\.\.\/assets\/widget-mark-dark\.png'\)/);
assert.match(component,/light:require\('\.\.\/\.\.\/assets\/widget-mark-light\.png'\)/);
assert.doesNotMatch(component,/require\('\.\.\/\.\.\/assets\/splash-mark\.png'\)/);
assert.match(component,/<Image source=\{colors\.isDark\?HOME_MARK\.dark:HOME_MARK\.light\}/);
assert.match(component,/const MARK_ASPECT=384\/337;/);
// Both header marks: the one 384×337 size MARK_ASPECT assumes, and a fully
// transparent outer frame, so no box can show around the mark on any theme.
for(const theme of ['dark','light']){
  const file='widget-mark-'+theme+'.png';
  const {data,info}=await sharp(readFileSync(new URL('../apps/mobile/assets/'+file,import.meta.url)))
    .ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.deepEqual([info.width,info.height],[384,337],file+' size');
  const alpha=(x,y)=>data[(y*info.width+x)*4+3];
  let frame=0;
  for(let x=0;x<info.width;x++)
    for(const y of [0,1,2,info.height-1])frame=Math.max(frame,alpha(x,y));
  for(let y=0;y<info.height;y++)
    for(const x of [0,1,2,info.width-3,info.width-2,info.width-1])frame=Math.max(frame,alpha(x,y));
  assert.equal(frame,0,file+' must have a transparent frame (no field box)');
}
assert.match(header,/<CamideyizBrandLogo compact=\{compact\}\/>/);
assert.doesNotMatch(component,/SYMBOL_PATH|camideyizIconBlue|react-native-svg/,
  'Do not redraw the brand mark as a different vector');
const plugin=readFileSync(
  new URL('../apps/mobile/plugins/withWidgetBoundaryBridge.js',import.meta.url),'utf8');
assert.match(plugin,/camideyiz-original-symbol\.png/);
assert.match(plugin,/widget_brand_symbol\.png/);
assert.match(plugin,/drawable-nodpi/);
console.log('Original owner-supplied symbol: exact asset hash, dimensions and widget wiring OK; home header shows the approved glossy stacked mark without a box');
