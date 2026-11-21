import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(relative)=>readFileSync(new URL('../'+relative,import.meta.url),'utf8');
const logo=read('apps/mobile/src/components/CamideyizBrandLogo.tsx');
const header=read('apps/mobile/src/features/prayer/HomeBrandHeader.tsx');
const wheel=read('apps/mobile/src/features/prayer/PrayerWheel.tsx');
const panel=read('apps/mobile/src/features/prayer/KerahatPanel.tsx');
const gallery=read('apps/mobile/src/app/(tabs)/gallery.tsx');

// The provided blue 3D logo is an immutable owner-supplied photo asset.
// Only enlarge its symbol, not the entire wordmark.
assert.match(logo,/source=\{BRAND_SYMBOL\}/);
assert.match(logo,/symbolWidth=horizontal\?\(compact\?85:95\)/);
assert.match(logo,/wordWidth=horizontal\?\(compact\?151:172\)/);
assert.match(header,/<CamideyizBrandLogo compact=\{compact\} horizontal\/>/);

// The mosque stays FIXED in the medallion just under its top ring and above
// the 'next prayer' caption. It must not rotate with the outer physical dial.
const gestureClosed=wheel.indexOf('</GestureDetector>');
const mosque=wheel.indexOf('<MaterialCommunityIcons name="mosque" size={36*scale}');
const kicker=wheel.indexOf("preview?'NAMAZ VAKİTLERİ'");
assert.ok(gestureClosed>=0&&mosque>gestureClosed&&kicker>mosque,
  'Mosque should stay stationary above the center label, outside gesture rotation');
assert.match(wheel,/position:'absolute',top:4\*scale,left:0,right:0/);

// Status ribbon/card with title 'Bugünün aralıkları' must not return.
// Keep individual approximate ranges and both heavy/light guides.
assert.doesNotMatch(panel,/styles\.statusRow|statusText=|\{statusText\}/);
assert.match(panel,/styles\.cards/);
assert.match(panel,/Ağır Kerahet/);
assert.match(panel,/Hafif Kerahet/);

// Never silently substitute a pre-cropped thumbnail for the full photograph.
// A fixed portrait frame with explicit Android Image width/height prevents
// unexpected source zooming; aligned rows are now the product requirement.
assert.match(gallery,/const photo=galleryPhoto\(item\.id\)/);
assert.doesNotMatch(gallery,/galleryThumbnail\(/);
assert.doesNotMatch(gallery,/previewAspectRatio\(/);
assert.doesNotMatch(gallery,/StyleSheet\.absoluteFill/);
assert.doesNotMatch(gallery,/resizeMethod="resize"/);
assert.match(gallery,/resizeMode="contain"/);
assert.match(gallery,/const TILE_PHOTO_RATIO=2\/3/);
assert.match(gallery,/style=\{\{width:width-2,height:imageHeight\}\}/);
assert.match(gallery,/flexWrap:'wrap'/);
assert.match(gallery,/tiles\.map\(slot=>/);
assert.match(gallery,/maxWidth:tileWidth\*2\+TILE_SPACING/);

// Keep ring calculation unchanged; kerahet stands out at a glance.
assert.match(wheel,/const kerahatArcs=ringWindows\.flatMap/);
assert.match(wheel,/strokeWidth=\{kerahatActive\?3\.5:kerahatApproaching\?2\.6:\.8\}/);
assert.match(wheel,/'KERAHET VAKTİ'/);
assert.match(wheel,/window\.state==='active'\?15\.5/);
assert.match(wheel,/window\.state==='active'\?14/);

console.log('Home visual QA: original emblem hierarchy, stationary mosque pin, uncropped aligned gallery, removed redundant card and strong kerahet cues OK');
