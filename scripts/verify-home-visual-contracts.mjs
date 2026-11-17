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
assert.match(panel,/Ağır Kerahat/);
assert.match(panel,/Hafif Kerahat/);

// Never silently substitute a pre-cropped thumbnail for the approved image.
// Also limit card width and retain the actual source aspect ratio.
assert.match(gallery,/const image=galleryPhoto\(slot\.id\)/);
assert.match(gallery,/const photo=galleryPhoto\(item\.id\)/);
assert.doesNotMatch(gallery,/galleryThumbnail\(/);
assert.match(gallery,/resizeMode="contain"/);
assert.match(gallery,/resizeMethod="resize"/);
assert.match(gallery,/const tileWidth=Math\.max\(118,Math\.min\(154,/);
assert.match(gallery,/return metadata\.width\/metadata\.height/);

// Keep ring calculation unchanged; kerahat stands out at a glance.
assert.match(wheel,/const kerahatArcs=ringWindows\.flatMap/);
assert.match(wheel,/strokeWidth=\{kerahatActive\?3\.5:kerahatApproaching\?2\.6:\.8\}/);
assert.match(wheel,/'KERAHAT VAKTİ'/);
assert.match(wheel,/window\.state==='active'\?15\.5/);
assert.match(wheel,/window\.state==='active'\?14/);

console.log('Home visual QA: original emblem hierarchy, stationary mosque pin, uncropped smaller gallery, removed redundant card and strong kerahat cues OK');
