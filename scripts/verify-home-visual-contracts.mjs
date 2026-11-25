import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  centerMedallionLayout,CENTER_DESIGN_DIAL,CENTER_GAP,CENTER_ROWS,CENTER_STACK_WIDTH,
  MEDALLION_FRACTION,MEDALLION_RINGS,MEDALLION_VIEWBOX,
  MINARET_BASE_HEIGHT,MINARET_BREATH,MINARET_SCALE,MINARET_VIEWBOX,
} from '../apps/mobile/src/features/prayer/centerMedallionLayout.ts';
import {
  MINARET_ART_BOTTOM,MINARET_ART_TOP,MINARET_DETAIL,MINARET_FILLS,MINARET_PALETTE,MINARET_SHAPES,
} from '../apps/mobile/src/features/prayer/ottomanMinaret.ts';

const read=(relative)=>readFileSync(new URL('../'+relative,import.meta.url),'utf8');
const logo=read('apps/mobile/src/components/CamideyizBrandLogo.tsx');
const header=read('apps/mobile/src/features/prayer/HomeBrandHeader.tsx');
const wheel=read('apps/mobile/src/features/prayer/PrayerWheel.tsx');
const medallion=read('apps/mobile/src/features/prayer/centerMedallionLayout.ts');
const minaretArt=read('apps/mobile/src/features/prayer/ottomanMinaret.ts');
const home=read('apps/mobile/src/app/(tabs)/index.tsx');
const panel=read('apps/mobile/src/features/prayer/KerahatPanel.tsx');
const gallery=read('apps/mobile/src/app/(tabs)/gallery.tsx');
const reminders=read('apps/mobile/src/app/companion.tsx');

// Home header shows the glossy stacked mark (symbol + wordmark) cut from the
// approved icon, ~86pt tall: the clean transparent splash-mark derivation on
// dark (the splash mark's faint field pixels read as a box on the header) and
// its ivory-legible deep-azure twin on light. Never a redrawn or flat substitute.
assert.match(logo,/dark:require\('\.\.\/\.\.\/assets\/widget-mark-dark\.png'\)/);
assert.match(logo,/light:require\('\.\.\/\.\.\/assets\/widget-mark-light\.png'\)/);
assert.doesNotMatch(logo,/splash-mark\.png'\)/,'no boxed splash mark in the header');
assert.match(logo,/source=\{colors\.isDark\?HOME_MARK\.dark:HOME_MARK\.light\}/);
assert.match(logo,/const MARK_ASPECT=384\/337;/);
assert.match(logo,/const height=compact\?72:86;/);
assert.match(logo,/style=\{\{height,width:Math\.round\(height\*MARK_ASPECT\)\}\}/);
assert.match(logo,/resizeMode="contain"/);
assert.match(logo,/accessibilityLabel="camideyiz\.biz"/);
assert.match(header,/<CamideyizBrandLogo compact=\{compact\}\/>/);
assert.doesNotMatch(header,/<CamideyizBrandLogo[^>]*horizontal/);
// The three heads reach the top of the mark's image: their room is explicit
// padding under the status bar, never a centred fixed-height box, and nothing
// clips the mark on any phone (regular ~22pt above the heads, compact ~14).
assert.match(header,/<View style=\{\{alignItems:'center',overflow:'visible',\s*paddingTop:compact\?5:7,paddingBottom:compact\?3:4\}\}>\s*<CamideyizBrandLogo compact=\{compact\}\/>/);
assert.doesNotMatch(header,/height:compact\?78:92|marginTop:-/);
assert.match(header,/return <View style=\{\{gap:compact\?6:7,paddingTop:compact\?0:2,marginBottom:2\}\}>/);
assert.match(home,/contentContainerStyle=\{\[styles\.content,\{paddingTop:compact\?7:11\}\]\}/);
assert.equal((home.match(/<SafeAreaView edges=\{\['top'\]\}/g)??[]).length,2,'both home states sit under the status bar inset');

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

// The Ottoman minaret is the stationary crown of the centre medallion: it
// must not rotate with the outer physical dial, and it is anchored to the
// top of the ring, OUT of the stack's shared gap. Below it, in order and one
// equal gap apart: ornament, "<vakit>a Kalan", countdown, [Kerahet],
// ornament, location, with no kicker line.
const gestureClosed=wheel.indexOf('</GestureDetector>');
const minaretAt=wheel.indexOf('<OttomanMinaret width={layout.minaret.width}');
const centerStack=wheel.indexOf('width:layout.stack.width,gap:layout.stack.gap,');
const order=['<CenterOrnament','PRAYER_COUNTDOWN_LABELS[nextKey]',
  ':countdown}','>Kerahet</Text>','<CenterOrnament','map-marker-outline']
  .reduce((positions,token)=>{
    const from=positions.length?positions.at(-1)+1:centerStack;
    return [...positions,wheel.indexOf(token,from)];
  },[]);
assert.ok(gestureClosed>=0&&minaretAt>gestureClosed&&centerStack>minaretAt&&
  order.every(i=>i>centerStack),
  'Centre must be stationary (outside gesture rotation): the minaret anchored '+
  'on its own, then ornament, title, countdown, Kerahet, ornament, location');
assert.equal((wheel.match(/<OttomanMinaret /g)??[]).length,1);
assert.doesNotMatch(wheel,/CENTER_GAP\*unit|<OttomanMinaret width=\{18\*unit\}/,
  'the minaret is no longer a stack item sharing the ornaments\' gap');
assert.match(wheel,/const layout=centerMedallionLayout\(size,showKerahet\);\s*const unit=layout\.unit;/);
assert.match(wheel,/minaret:\{position:'absolute'\}/);
assert.match(wheel,/<View style=\{\[styles\.minaret,\{\s*left:layout\.minaret\.left,top:layout\.minaret\.top,\s*\}\]\}>/);
assert.match(wheel,/<OttomanMinaret width=\{layout\.minaret\.width\} height=\{layout\.minaret\.height\}/);
assert.match(wheel,/center:\{position:'absolute',alignItems:'center'\}/);
assert.match(wheel,/left:layout\.stack\.left,top:layout\.stack\.top,/);
// The drawn medallion and rows are exactly the measured ones below.
assert.match(wheel,/width:layout\.medallion,height:layout\.medallion,/);
assert.match(wheel,/viewBox=\{'0 0 '\+MEDALLION_VIEWBOX\+' '\+MEDALLION_VIEWBOX\}/);
assert.match(wheel,/r=\{MEDALLION_RINGS\.outer\}/);
assert.match(wheel,/r=\{MEDALLION_RINGS\.inner\}[\s\S]{0,80}strokeWidth=\{MEDALLION_RINGS\.innerStroke\}/);
assert.match(wheel,/cy=\{MEDALLION_MID\+MEDALLION_RINGS\.dots\*Math\.sin\(a\)\}\s*r=\{MEDALLION_RINGS\.dotRadius\}/);
assert.match(wheel,/height:CENTER_ROWS\.ornament\*unit/);
assert.match(wheel,/lineHeight:CENTER_ROWS\.title\*unit/);
assert.match(wheel,/lineHeight:CENTER_ROWS\.countdown\*unit,\s*marginTop:CENTER_ROWS\.countdownGap\*unit/);
assert.match(wheel,/lineHeight:CENTER_ROWS\.kerahet\*unit/);
assert.match(wheel,/height:CENTER_ROWS\.location\*unit,maxWidth:layout\.locationMaxWidth/);
assert.match(wheel,/<Svg width=\{width\} height=\{height\}\s*viewBox=\{'0 0 '\+MINARET_VIEWBOX\.width\+' '\+MINARET_VIEWBOX\.height\}>/);
assert.match(medallion,/const unit=size\/CENTER_DESIGN_DIAL;/);
assert.equal(CENTER_DESIGN_DIAL,366);
assert.equal(MEDALLION_FRACTION,.585);
assert.equal(MEDALLION_VIEWBOX,220);
assert.deepEqual({...MEDALLION_RINGS},{outer:108,inner:104,innerStroke:.8,dots:101,dotRadius:.68});
assert.deepEqual({...MINARET_VIEWBOX},{width:40,height:96,top:3.2,bottom:95.8});
assert.deepEqual({...CENTER_ROWS},
  {ornament:10,title:21,countdownGap:1,countdown:36,kerahet:16,location:16});
assert.equal(CENTER_STACK_WIDTH,180);
// Size: 1.5× the former 44px minaret, same proportions. Position: one even
// 3px breath under the top gold dot ring and above the first ornament.
assert.equal(MINARET_BASE_HEIGHT,44);
assert.equal(MINARET_SCALE,1.5);
assert.equal(MINARET_BREATH,3);
assert.deepEqual({...CENTER_GAP},{normal:6.5,kerahet:3});

// Measure the layout on every dial the home screen draws: Math.min(width-10,
// 366), so a 320pt phone (the smallest) gets a 310pt dial, up to the cap.
assert.match(home,/const wheelSize=Math\.min\(width-10,366\);/);
const close=(actual,expected,message)=>
  assert.ok(Math.abs(actual-expected)<=1e-9*Math.max(1,Math.abs(expected)),
    message+': '+actual+' ≠ '+expected);
// Every vertex of the minaret art (viewBox 40×96): the alem horns are its
// top, the plinth its base, exactly where MINARET_VIEWBOX says the gold is.
const minaretGold=MINARET_SHAPES.flatMap(({d})=>
  [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map(([,x,y])=>[+x,+y]));
assert.ok(minaretGold.length>=100,'minaret vertices parsed: '+minaretGold.length);
assert.equal(MINARET_ART_TOP,MINARET_VIEWBOX.top);
assert.equal(MINARET_ART_BOTTOM,MINARET_VIEWBOX.bottom);
assert.equal(Math.min(...minaretGold.map(([,y])=>y)),MINARET_VIEWBOX.top,'alem horns are the top of the gold');
assert.equal(Math.max(...minaretGold.map(([,y])=>y)),MINARET_VIEWBOX.bottom,'plinth is the base of the gold');
assert.ok(minaretGold.every(([x])=>x>0&&x<MINARET_VIEWBOX.width),'minaret inside its viewBox');
const reference={false:centerMedallionLayout(CENTER_DESIGN_DIAL,false),
  true:centerMedallionLayout(CENTER_DESIGN_DIAL,true)};
for(const dial of [300,310,320,340,350,360,366]){
  for(const kerahet of [false,true]){
    const label=dial+'pt dial, '+(kerahet?'Kerahet':'normal');
    const layout=centerMedallionLayout(dial,kerahet);
    const unit=dial/CENTER_DESIGN_DIAL,side=dial*MEDALLION_FRACTION,centre=side/2;
    const ring=side/MEDALLION_VIEWBOX;
    const dotRing=(MEDALLION_RINGS.dots-MEDALLION_RINGS.dotRadius)*ring;
    const innerRing=(MEDALLION_RINGS.inner-MEDALLION_RINGS.innerStroke/2)*ring;
    const breath=MINARET_BREATH*unit;
    close(layout.medallion,side,label+': medallion');
    // Everything scales with the dial: same layout in 366pt design px.
    for(const [key,value] of Object.entries(layout.minaret))
      close(value/unit,reference[kerahet].minaret[key],label+': minaret.'+key+' scales');
    for(const [key,value] of Object.entries(layout.stack))
      close(value/unit,reference[kerahet].stack[key],label+': stack.'+key+' scales');
    // Minaret: 1.5× tall, art proportions, centred, anchored at the top.
    const {left,top,width,height}=layout.minaret;
    close(height,MINARET_BASE_HEIGHT*1.5*unit,label+': minaret height');
    close(width/height,40/96,label+': minaret proportions');
    close(left*2+width,side,label+': minaret centred');
    const alemTip=top+height*3.2/96,base=top+height*95.8/96;
    close(alemTip-(centre-dotRing),breath,label+': alem tip one breath under the gold dot ring');
    assert.ok(alemTip<side*.07,label+': minaret anchored near the medallion top');
    // The horns sit just off the centre line, so radially they keep 99% of
    // the vertical breath; every other vertex keeps more.
    for(const [x,y] of minaretGold){
      const r=Math.hypot(left+x/40*width-centre,top+y/96*height-centre);
      if(!(r<=dotRing-.99*breath))
        assert.fail(label+': minaret gold ('+x+','+y+') keeps clear of the ring');
    }
    // Stack: starts one breath under the minaret base (never under its box),
    // centred, one equal gap between its own rows.
    const stack=layout.stack;
    close(stack.top-base,breath,label+': stack one breath under the minaret');
    assert.ok(stack.top>top+height,label+': stack clear of the minaret box');
    close(stack.left*2+stack.width,side,label+': stack centred');
    close(stack.width,CENTER_STACK_WIDTH*unit,label+': stack width');
    close(stack.gap,(kerahet?CENTER_GAP.kerahet:CENTER_GAP.normal)*unit,label+': stack gap');
    assert.ok(stack.gap>=breath-1e-9,label+': stack gap never tighter than the breath');
    const rows=[CENTER_ROWS.ornament,
      CENTER_ROWS.title+CENTER_ROWS.countdownGap+CENTER_ROWS.countdown+
        (kerahet?CENTER_ROWS.kerahet:0),
      CENTER_ROWS.ornament,CENTER_ROWS.location].map(row=>row*unit);
    close(stack.height,rows.reduce((a,b)=>a+b)+3*stack.gap,label+': equal gaps between rows');
    const rowTop=rows.map((_,i)=>stack.top+rows.slice(0,i).reduce((a,b)=>a+b,0)+i*stack.gap);
    // Both ornaments (rules 54 + gaps 6 + star 10) end inside the dot ring.
    for(const i of [0,2]){
      const rule=Math.hypot(65*unit,rowTop[i]+rows[i]/2-centre);
      assert.ok(rule<=dotRing-breath+1e-9,label+': ornament '+(i?2:1)+' inside the ring');
    }
    // The title line, up to the full stack width, stays inside the dot ring.
    for(const y of [rowTop[1],rowTop[1]+CENTER_ROWS.title*unit])
      assert.ok(Math.hypot(stack.width/2,y-centre)<dotRing,label+': title inside the ring');
    // Location row: never lower than the dot ring, corners on or inside the
    // inner gold ring, and at least the room the Kerahet state always had.
    const bottom=stack.top+stack.height;
    assert.ok(bottom-centre<=dotRing-breath,label+': location row above the ring');
    assert.ok(Math.hypot(layout.locationMaxWidth/2,bottom-centre)<=innerRing+1e-9,
      label+': location row corners inside the inner gold ring');
    assert.ok(layout.locationMaxWidth>=86*unit,label+': location row keeps its room');
  }
}
// Süleymaniye-type minaret, top to bottom: gilded alem (crescent, horns up,
// over two bulbs), lead pencil külah, windowed petek, three şerefe (pierced
// railing, slab, muqarnas cells) and a fluted, coursed stone shaft on a base.
assert.deepEqual(MINARET_SHAPES[0],
  {fill:'gilt',d:'M17.7 3.2a2.3 2.3 0 0 0 4.6 0a2.7 2.7 0 0 1 -4.6 0Z'},'alem crescent');
assert.equal(MINARET_SHAPES.filter(shape=>shape.fill==='lead').length,1,'one lead külah');
assert.deepEqual([...MINARET_FILLS],['lead','stone','gilt']);
assert.equal((minaretArt.match(/^const below\d=serefe\(SEREFE\[\d\]\);$/gm)??[]).length,3,'three şerefe');
for(const [key,min] of [['cut',45],['niches',70],['courses',30],['glints',4],['drops',3]])
  assert.ok((MINARET_DETAIL[key].match(/M/g)??[]).length>=min,'minaret detail: '+key);
// Pieces are shaded as cylinders; openings are cut in the medallion colour;
// the art redraws only on a theme or size change.
assert.match(wheel,/const OttomanMinaret=memo\(function OttomanMinaret\(/);
assert.match(wheel,/id=\{'minaret-'\+fill\}\s*x1="0" y1="0" x2="1" y2="0"/);
assert.match(wheel,/fill=\{'url\(#minaret-'\+shape\.fill\+'\)'\}/);
assert.match(wheel,/<Path d=\{MINARET_DETAIL\.cut\} fill=\{cutout\}\/>/);
assert.match(wheel,/cutout=\{colors\.isDark\?'#08253C':'#FEF7EA'\}/);
// Dark theme: gold, warm ivory and slate on midnight blue, never green.
const hue=hex=>{
  const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
  const max=Math.max(r,g,b),d=max-Math.min(r,g,b);
  if(!d)return null;
  const h=(max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4)*60;
  return h<0?h+360:h;
};
const darkMinaret=Object.values(MINARET_PALETTE.dark).flat().filter(c=>typeof c==='string');
assert.ok(darkMinaret.length>=16);
for(const color of darkMinaret){
  const h=hue(color);
  assert.ok(h===null||h<85||h>175,'dark minaret colour '+color+' must not be green');
}
assert.equal((wheel.match(/<CenterOrnament unit=\{unit\}/g)??[]).length,2);
assert.doesNotMatch(wheel,/name="mosque"/);
assert.doesNotMatch(wheel,/SIRADAKİ VAKİT|'KERAHET VAKTİ'|KERAHET YAKLAŞIYOR/);
assert.doesNotMatch(wheel,/styles\.kicker/);
// Texts are sized with the dial (not system font scale) so the stack stays
// inside the medallion; the location row narrows as it sits lower.
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

// Reminders screen: each section title shares its row with a switch or a
// button. The title takes only the width left beside it (9pt gap) and
// shrinks to fit on one line instead of running under the control.
assert.match(reminders,/const SECTION_TITLE_FIT=\{numberOfLines:1,adjustsFontSizeToFit:true,minimumFontScale:\.65\} as const;/);
assert.match(reminders,/sectionHeader:\{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:9\}/);
assert.match(reminders,/sectionLead:\{flex:1,flexDirection:'row',gap:8,alignItems:'center'\}/);
assert.match(reminders,/sectionTitle:\{flexShrink:1,/);
const sectionHeaders=(reminders.match(/<View style=\{styles\.sectionHeader\}>/g)??[]).length;
const fittedTitles=(reminders.match(
  /<View style=\{styles\.sectionHeader\}>\s*<View style=\{styles\.sectionLead\}>\s*<[A-Za-z]+ name="[\w-]+" size=\{\d+\} color=\{colors\.gold\}\/>\s*<Text \{\.\.\.SECTION_TITLE_FIT\} style=\{\[styles\.sectionTitle,/g)??[]).length;
assert.ok(sectionHeaders>=4&&fittedTitles===sectionHeaders,
  'every reminders section title fits beside its switch or button ('+fittedTitles+'/'+sectionHeaders+')');
assert.match(reminders,/<Text \{\.\.\.SECTION_TITLE_FIT\}[^>]*>\s*Namaz Vakti Hatırlatmaları\s*<\/Text>/);

console.log('Home visual QA: glossy stacked brand mark, centred date rule, 1.5× Süleymaniye-type minaret crowning the medallion one breath under its gold ring with an equal-gap stack and live Kerahet line on every dial size, uncropped aligned gallery, removed redundant rows, strong kerahet cues and reminders titles that fit beside their switches OK');
