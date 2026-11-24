import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(relative)=>readFileSync(new URL('../'+relative,import.meta.url),'utf8');
const logo=read('apps/mobile/src/components/CamideyizBrandLogo.tsx');
const header=read('apps/mobile/src/features/prayer/HomeBrandHeader.tsx');
const wheel=read('apps/mobile/src/features/prayer/PrayerWheel.tsx');
const home=read('apps/mobile/src/app/(tabs)/index.tsx');
const panel=read('apps/mobile/src/features/prayer/KerahatPanel.tsx');
const gallery=read('apps/mobile/src/app/(tabs)/gallery.tsx');

// Home header shows the glossy stacked mark (symbol + wordmark) cut from the
// approved icon, ~86pt tall: the splash mark on dark, its ivory-legible
// deep-azure derivation on light. Never a redrawn or flat substitute.
assert.match(logo,/dark:require\('\.\.\/\.\.\/assets\/splash-mark\.png'\)/);
assert.match(logo,/light:require\('\.\.\/\.\.\/assets\/widget-mark-light\.png'\)/);
assert.match(logo,/source=\{colors\.isDark\?HOME_MARK\.dark:HOME_MARK\.light\}/);
assert.match(logo,/const height=compact\?72:86;/);
assert.match(logo,/accessibilityLabel="camideyiz\.biz"/);
assert.match(header,/<CamideyizBrandLogo compact=\{compact\}\/>/);
assert.doesNotMatch(header,/<CamideyizBrandLogo[^>]*horizontal/);

// Date row: the rule sits at the screen centre with identical gaps; the
// Hijri date hugs it from the left, the Gregorian date from the right.
assert.match(home,/const DATE_RULE_GAP=9;/);
assert.match(home,/dateHijri:\{textAlign:'right'\}/);
assert.match(home,/dateGregorian:\{textAlign:'left'\}/);
assert.match(home,/dateRule:\{width:1,height:18,marginHorizontal:DATE_RULE_GAP,/);
assert.match(home,/styles\.dateText,styles\.dateHijri/);
assert.match(home,/styles\.dateText,hijri\?styles\.dateGregorian:null/);

// No status row between the dial and the prayer cards ("● Akşam vaktine …",
// "KERAHET · …", "Kerahete N dk"): the dial centre carries that information.
assert.doesNotMatch(home,/tinyActions/);
assert.doesNotMatch(home,/'KERAHET · '\+restriction\.title|'Kerahete '\+kerahatMinutes/);

// The Ottoman minaret stays FIXED at the top of the centre stack. It must
// not rotate with the outer physical dial. Stack order: minaret, ornament,
// "<vakit>a Kalan", countdown, [Kerahet], ornament, location, with one
// shared gap around both ornaments and no kicker line.
const gestureClosed=wheel.indexOf('</GestureDetector>');
const centerStack=wheel.indexOf('gap:CENTER_GAP*unit}]}>');
const order=['<OttomanMinaret','<CenterOrnament','PRAYER_COUNTDOWN_LABELS[nextKey]',
  ':countdown}','>Kerahet</Text>','<CenterOrnament','map-marker-outline']
  .reduce((positions,token)=>{
    const from=positions.length?positions.at(-1)+1:centerStack;
    return [...positions,wheel.indexOf(token,from)];
  },[]);
assert.ok(gestureClosed>=0&&centerStack>gestureClosed&&order.every(i=>i>centerStack),
  'Centre stack must be stationary (outside gesture rotation) and ordered '+
  'minaret, ornament, title, countdown, Kerahet, ornament, location');
assert.match(wheel,/const CENTER_GAP = 8;/);
assert.match(wheel,/const unit=size\/CENTER_DESIGN_DIAL;/);
assert.match(wheel,/<Svg width=\{width\} height=\{height\} viewBox="0 0 40 96">/);
assert.match(wheel,/id="minaretGold" x1="0" y1="0" x2="1" y2="0"/);
assert.match(wheel,/'#B8995E','#F3DFB0','#E2C88F','#A88A55'/);
assert.match(wheel,/<Path d="M17\.4 3\.2a2\.6 2\.6 0 0 0 5\.2 0a3\.1 3\.1 0 0 1-5\.2 0z"\/>/,
  'alem crescent');
assert.equal((wheel.match(/<CenterOrnament unit=\{unit\}/g)??[]).length,2);
assert.doesNotMatch(wheel,/name="mosque"/);
assert.doesNotMatch(wheel,/SIRADAKİ VAKİT|'KERAHET VAKTİ'|KERAHET YAKLAŞIYOR/);
assert.doesNotMatch(wheel,/styles\.kicker/);
// Texts are sized with the dial (not system font scale) so the stack stays
// inside the medallion; the location row narrows when Kerahet is shown.
assert.match(wheel,/maxWidth:\(showKerahet\?86:112\)\*unit/);
assert.ok((wheel.match(/allowFontScaling=\{false\}/g)??[]).length>=6);

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
assert.match(wheel,/window\.state==='active'\?15\.5/);
assert.match(wheel,/window\.state==='active'\?14/);
// Live kerahet: a short orange "Kerahet" line under the countdown.
assert.match(wheel,/const KERAHET_LABEL_COLOR=\{dark:'#F2A54A',light:'#A64B0B'\}/);
assert.match(wheel,/const showKerahet=!preview&&!isManualSelection&&kerahatActive;/);
assert.match(wheel,/\{showKerahet\?<Text/);

console.log('Home visual QA: glossy stacked brand mark, centred date rule, stationary minaret centre stack with live Kerahet line, uncropped aligned gallery, removed redundant rows and strong kerahet cues OK');
