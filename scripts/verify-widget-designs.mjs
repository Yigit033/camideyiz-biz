/**
 * Widget Design 7.0–11.0 — native launcher first, countdown-first, one
 * system typeface, exactly centred box text, one fitted size per text group.
 * Structural QA only: physical launcher scaling and UI jank require APK tests.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const read=p=>readFileSync(resolve(import.meta.dirname,'..',p),'utf8');
const p='apps/mobile/plugins/widget-native/';
const plugin=read('apps/mobile/plugins/withWidgetBoundaryBridge.js');
const scheduler=read(p+'WidgetBoundaryScheduler.java');
const pipe=read(p+'WidgetRenderPipeline.java');
const variants=[
  'widget_compact_prayer','widget_next_prayer','widget_prayer_day',
  'widget_prayer_focus','widget_prayer_strip','widget_ring_mini',
  'widget_ring_premium','widget_slim_prayer','widget_ring_square',
  'widget_prayer_row','widget_prayer_column',
];
const clocks={
  widget_compact_prayer:'widget_compact_countdown',
  widget_next_prayer:'widget_next_countdown',
  widget_prayer_day:'widget_day_countdown',
  widget_prayer_focus:'widget_focus_countdown',
  widget_prayer_strip:'widget_strip_countdown',
  widget_ring_mini:'widget_ring_mini_countdown',
  widget_ring_premium:'widget_ring_premium_countdown',
  widget_slim_prayer:'widget_slim_countdown',
  widget_ring_square:'widget_ring_square_countdown',
  widget_prayer_row:'widget_row_countdown',
  widget_prayer_column:'widget_col_countdown',
};
const secondary={
 widget_compact_prayer:'widget_compact_name',
 widget_next_prayer:'widget_next_name',
 widget_prayer_focus:'widget_focus_current',
 widget_prayer_strip:'widget_strip_time_0',
 widget_ring_mini:'widget_ring_mini_time',
 widget_ring_premium:'widget_ring_premium_next',
 widget_slim_prayer:'widget_slim_time',
 widget_ring_square:'widget_ring_square_next',
 widget_prayer_day:'widget_day_time_0',
 widget_prayer_row:'widget_row_time_0',
 widget_prayer_column:'widget_col_time_0',
};
function element(xml,id){
  const tags=[...xml.matchAll(/<(TextView|Chronometer|LinearLayout|ImageView)\b[^<>]*\/?>/g)].map(x=>x[0]);
  const tag=tags.find(t=>t.includes('android:id="@+id/'+id+'"'));
  assert.ok(tag,'Missing ID '+id);
  return tag;
}
function font(xml,id){
  const tag=element(xml,id),m=tag.match(/android:textSize="(\d+)sp"/);
  assert.ok(m,'Missing text size '+id);
  return Number(m[1]);
}
// Minimal layout tree (parents, siblings, attributes) for structural rules.
function tree(xml){
  const top={tag:'#document',attrs:'',children:[]},stack=[top];
  for(const [,close,tag,attrs,self] of xml.replace(/<!--[\s\S]*?-->/g,'')
      .matchAll(/<(\/?)([A-Za-z]+)\b([^<>]*?)(\/?)>/g)){
    if(close){stack.pop();continue;}
    const node={tag,attrs,children:[],parent:stack.at(-1)};
    stack.at(-1).children.push(node);
    if(!self)stack.push(node);
  }
  return top.children[0];
}
const attr=(node,name)=>node.attrs.match(new RegExp('android:'+name+'="([^"]*)"'))?.[1];
function* walk(node){yield node;for(const child of node.children)yield* walk(child);}
const dp=(node,name)=>{const v=attr(node,name);return v===undefined?0:Number(v.replace(/dp$/,''));};
const pad=(node,side)=>{
  const v=attr(node,'padding'+side)??attr(node,'padding');
  return v===undefined?0:Number(v.replace(/dp$/,''));
};
for(const kind of variants){
  const info=read(p+kind+'_info.xml');
  assert.match(info,/android:updatePeriodMillis="1800000"/);
  assert.match(info,/android:widgetCategory="home_screen\|keyguard"/);
  assert.ok(plugin.includes("'"+kind+"_info.xml'"),'CNG missing '+kind+'_info.xml');
  for(const suffix of ['', '_light']){
    const file=kind+suffix+'.xml',xml=read(p+file);
    assert.ok(plugin.includes("'"+file+"'"),'CNG missing '+file);
    assert.match(xml,/xmlns:android=/);
    assert.match(xml,/@drawable\/widget_bg/);
    // Theme-matched transparent mark: glowing cyan on navy, deep azure on ivory.
    assert.match(xml,suffix?/@drawable\/widget_brand_mark_light"/:/@drawable\/widget_brand_mark_dark"/);
    assert.doesNotMatch(xml,suffix?/widget_brand_mark_dark/:/widget_brand_mark_light/);
    assert.doesNotMatch(xml,/widget_brand_lockup/,'the opaque square badge logo is retired');
    // singleLine makes TextView autosize treat the width as unbounded
    // (horizontal scrolling), which ellipsized countdowns as "7:29:…".
    assert.doesNotMatch(xml,/android:singleLine=/,'use maxLines="1": '+file);
    assert.doesNotMatch(xml,/<View\b|android:text="Camideyiz Biz"|@drawable\/widget_brand_symbol/,
      'Native RemoteViews must use supported tags and a SINGLE supplied logo: '+file);
    assert.doesNotMatch(xml,/Pendik|Tuzla|12:54|28:40/,
      'Initial widget layouts must not ship fabricated clocks/locations');
    assert.match(element(xml,clocks[kind]),/^<Chronometer\b/);
    assert.match(element(xml,clocks[kind]),/android:maxLines="1"/);
    const hero=font(xml,clocks[kind]),comparison=font(xml,secondary[kind]);
    assert.ok(hero>comparison,kind+suffix+' countdown must dominate its next clock/name ('+
      hero+' vs '+comparison+')');
  }
}
const comp=read(p+'widget_compact_prayer.xml');
assert.ok(font(comp,clocks.widget_compact_prayer)>=15);
// "İmsak 06:24" is ONE autosized view: two views split the ~70dp cell and
// clipped the clock ("06:2") on ColorOS.
assert.doesNotMatch(comp,/widget_compact_time/);
assert.match(scheduler,/R\.id\.widget_compact_name,ready\?next\+"  "\+time/);
// 2×2 likewise: "Akşam  17:45" is ONE centred line. Two half-width views
// autosized the name and the clock to different sizes and sat off-centre.
for(const suffix of ['','_light']){
  const next=read(p+'widget_next_prayer'+suffix+'.xml');
  assert.doesNotMatch(next,/widget_next_time/);
  assert.match(element(next,'widget_next_name'),/android:layout_width="match_parent"[^>]*android:gravity="center"/);
}
assert.doesNotMatch(scheduler,/R\.id\.widget_next_time/);
assert.match(scheduler,/R\.id\.widget_next_name,ready\?next\+"  "\+time/);
assert.match(read(p+'widget_compact_prayer_info.xml'),/targetCellWidth="1"/);
assert.match(read(p+'widget_compact_prayer_info.xml'),/targetCellHeight="1"/);
assert.match(read(p+'widget_slim_prayer_info.xml'),/targetCellWidth="1"/);
assert.match(read(p+'widget_slim_prayer_info.xml'),/targetCellHeight="2"/);
const square=read(p+'widget_ring_square_info.xml');
assert.match(square,/targetCellWidth="2"/);
assert.match(square,/targetCellHeight="2"/);
assert.match(square,/resizeMode="none"/);
assert.match(read(p+'widget_ring_mini_info.xml'),/targetCellWidth="2"/);
assert.match(read(p+'widget_ring_premium_info.xml'),/targetCellWidth="4"/);
assert.match(read(p+'widget_ring_premium_info.xml'),/targetCellHeight="4"/);
assert.match(read(p+'widget_prayer_strip_info.xml'),/targetCellWidth="4"/);
assert.match(read(p+'widget_prayer_strip_info.xml'),/targetCellHeight="2"/);
for(const suffix of ['', '_light']){
  const mini=read(p+'widget_ring_mini'+suffix+'.xml');
  const premium=read(p+'widget_ring_premium'+suffix+'.xml');
  const squared=read(p+'widget_ring_square'+suffix+'.xml');
  assert.match(mini,/widget_ring_mini_art/);
  assert.match(premium,/widget_ring_premium_art/);
  assert.match(squared,/widget_ring_square_art/);
  assert.match(squared,/android:background="@drawable\/widget_bg(_light)?"/);
  assert.match(premium,/widget_ring_premium_cell_0/);
  assert.match(premium,/widget_ring_premium_cell_5/);
  const strip=read(p+'widget_prayer_strip'+suffix+'.xml');
  for(let i=0;i<6;i++){
    element(strip,'widget_strip_cell_'+i);
    element(strip,'widget_strip_label_'+i);
    element(strip,'widget_strip_time_'+i);
    element(premium,'widget_ring_premium_clock_'+i);
  }
  // Footer = 46dp floor + weighted growth: the caption sits ABOVE the centred
  // countdown, so the footer is taller to keep the countdown large.
  assert.match(element(strip,'widget_strip_remaining_row'),
    /android:layout_height="46dp" android:layout_weight="0\.34"/);
  const day=read(p+'widget_prayer_day'+suffix+'.xml');
  for(let i=0;i<6;i++){
    element(day,'widget_day_row_'+i);
    element(day,'widget_day_label_'+i);
    element(day,'widget_day_time_'+i);
  }
  assert.match(day,/android:layout_height="44dp" android:layout_weight="0\.34"/);
  const slim=read(p+'widget_slim_prayer'+suffix+'.xml');
  assert.match(slim,/KALAN SÜRE/);
  assert.doesNotMatch(slim,/android:textSize="24sp"/,
    '1×2 width cannot safely render an oversized HH:MM:SS chronometer');
}
assert.match(scheduler,/setChronometerCountDown\(viewId,true\)/);
assert.match(scheduler,/SystemClock\.elapsedRealtime\(\)\+remaining/);
for(const [name,id] of Object.entries(clocks)){
  assert.match(scheduler,new RegExp('R\\.id\\.'+id),
    'Native scheduler must drive '+name+' countdown');
}
for(const token of ['widget_ring_square_root','widget_ring_square_art',
    'installedSquareRing','widget_day_footer','widget_day_countdown'])
  assert.match(scheduler,new RegExp(token));
assert.match(scheduler,/updateSized\(manager,squareRing,/);
assert.match(scheduler,/nextInCurrentDay\?label\.equals\(next\):i==5/,
  'After Yatsı do not highlight today’s expired İmsak');
assert.match(scheduler,/BRAND_VERSION=6;/);
assert.match(pipe,/dirty\[8\]&&installed\[8\]\.length>0/);
assert.match(pipe,/PrayerRingBitmapRenderer\.render\(times,now,PrayerRingBitmapRenderer\.SMALL\)/);
assert.match(pipe,/PrayerRingBitmapRenderer\.render\(times,now,PrayerRingBitmapRenderer\.LARGE\)/);
const ring=read(p+'PrayerRingBitmapRenderer.java');
// Home-dial look: prayer colours, gold rim + hour ticks, "now" pointer at 12.
const geo=name=>Number(ring.match(new RegExp('static final float '+name+'=([.0-9]+)f'))[1]);
const [R,B,M]=[geo('RADIUS'),geo('BAND'),geo('MARKER')];
assert.ok(R+B/2+.010+.024<.5,'hour ticks leave the bitmap');
assert.ok(R+B/2+.006+M<.5,'now pointer leaves the bitmap');
assert.ok(R-B/2-.010>=.36,'centre text needs the gold inner rim at ≥ .36 of the side');
assert.match(ring,/0xFF3593B5,0xFFD69E44,0xFF1EAFB0,0xFF10B981,0xFFDA7049,0xFF7162BB/);
// Turns with the clock: current time at the top, re-rendered every 5 minutes
// by a NON-wakeup alarm (no battery cost while the phone sleeps).
assert.match(ring,/return -90f\+\(minute-now\)\*\.25f;/);
assert.match(ring,/"\|"\+minuteNow\+"\|"/,'cache must not serve a stale turn');
assert.match(scheduler,/manager\.set\(AlarmManager\.RTC,\(now\/RING_TICK_MS\+1\)\*RING_TICK_MS,tick\)/);
assert.doesNotMatch(scheduler,/RTC_WAKEUP,[^;]*RING_TICK/);
assert.match(scheduler,/scheduleRingTick\(app,ringHosts>0,now\)/);
assert.match(scheduler,/date\+"\|"\+next\+"\|"\+day\+turn,city/);
assert.match(read(p+'WidgetBoundaryReceiver.java'),/action\.equals\(WidgetBoundaryScheduler\.RING_TICK\)/);
// Drawn near display size (2×2 ≈ 150dp, 4×4 ≈ 240dp at 3×): no 2-3× upscaling blur.
assert.match(ring,/SMALL=448,LARGE=720/);
// Ring + outer rim (r+.043) and active halo must stay inside the bitmap.

// Widget Design 8.0 — adaptive space: content scales with the launcher cell.
for(const kind of variants){
  for(const suffix of ['','_light']){
    const xml=read(p+kind+suffix+'.xml');
    // Every countdown autosizes into a definite box: a wrap_content
    // Chronometer was what ellipsized "7:58:…" in the 1×2 widget.
    const hero=element(xml,clocks[kind]);
    assert.match(hero,/android:autoSizeTextType="uniform"/,kind+suffix+' countdown must autosize');
    assert.match(hero,/android:layout_width="(match_parent|0dp)"/,kind+suffix+' countdown needs a definite width');
    assert.match(hero,/android:layout_height="(match_parent|0dp)"/,kind+suffix+' countdown needs a definite height');
    const max=Number(hero.match(/autoSizeMaxTextSize="(\d+)sp"/)[1]);
    assert.ok(max>font(xml,clocks[kind]),kind+suffix+' countdown must be able to grow');
    // Countdown-first must hold at EVERY size, not only at default sp.
    const secondMax=Number(element(xml,secondary[kind])
      .match(/autoSizeMaxTextSize="(\d+)sp"/)?.[1]??font(xml,secondary[kind]));
    assert.ok(max>secondMax,kind+suffix+' secondary text may outgrow the countdown ('+
      secondMax+' vs '+max+')');
    // Every autosized view has a definite box and a single line.
    for(const tag of xml.match(/<(TextView|Chronometer)\b[^<>]*autoSizeTextType[^<>]*>/g)??[]){
      assert.doesNotMatch(tag,/android:layout_(width|height)="wrap_content"/,
        'autosize needs fixed/weighted bounds: '+kind+suffix);
      assert.match(tag,/android:maxLines="1"/);
      assert.doesNotMatch(tag,/android:ellipsize=/,'autosized text must shrink, not ellipsize');
    }
  }
}
// 1×2: "KALAN SÜRE" and HH:MM:SS shrink to the narrow column instead of "…".
const slimXml=read(p+'widget_slim_prayer.xml');
assert.match(slimXml,/android:text="KALAN SÜRE"[^>]*autoSizeTextType="uniform"/);
// Ring centre text sits in a box proportional to the ring (weighted spacers),
// so it scales with the ring instead of floating at a fixed sp size.
for(const name of ['widget_ring_mini','widget_ring_square','widget_ring_premium']){
  const xml=read(p+name+'.xml');
  // The weighted stage centres an exact-square frame (Android 12+ sizes), so
  // the centre text box is the ring itself on tall ColorOS cells.
  const short=name.replace('widget_ring_','');
  assert.match(element(xml,'widget_ring_'+short+'_stage'),/android:layout_weight="1"/);
  assert.ok(xml.includes('<FrameLayout android:id="@+id/widget_ring_'+short+'_frame"'),name+' frame');
  assert.ok(scheduler.includes('squareRingFrame(card,R.id.widget_ring_'+short+'_frame'),name+' sizing');
  assert.ok((xml.match(/android:layout_weight="0\.\d+" android:text=""\/>/g)??[]).length>=4,
    name+' needs proportional horizontal and vertical spacers around the centre text');
}
assert.match(ring,/sector\(canvas,pen,ring,0,boundaries\[0\],COLORS\[5\]/);
assert.doesNotMatch(ring,/fetch\(|HttpURLConnection|WebView/);
// Widget Design 9.0 — owner-approved: large mark, outlined 1×1, kerahet outline,
// resizable six-prayer row and column.
for(const suffix of ['','_light']){
  const compact=read(p+'widget_compact_prayer'+suffix+'.xml');
  const mark=element(compact,'widget_compact_next_row');
  assert.match(mark,/android:background="@drawable\/widget_box_(dark|light)"/);
  assert.match(element(compact,'widget_compact_remaining_row'),
    /android:background="@drawable\/widget_box_(dark|light)"/);
  assert.match(compact,/<ImageView[^>]*android:layout_weight="0\.34"[^>]*widget_brand_mark_/,
    '1×1 brand mark keeps a third of the cell; the countdown box gets the most');
  // Glyphs must clear the 11dp rounded outline of the boxes.
  assert.match(element(compact,'widget_compact_remaining_row'),/android:paddingStart="8dp" android:paddingEnd="8dp"/);
  // Owner feedback: "Kalan" a little lower and blue like the countdown;
  // kerahet never adds text to the 1×1 (outline only).
  const label=element(compact,'widget_compact_remaining_label');
  const blue=suffix?'#0C76B4':'#3CC8F5';
  assert.ok(label.includes('android:textColor="'+blue+'"'),'1×1 "Kalan" is blue');
  assert.ok(element(compact,'widget_compact_countdown').includes('android:textColor="'+blue+'"'));
  assert.match(element(compact,'widget_compact_remaining_row'),
    /android:paddingTop="4dp" android:paddingBottom="0dp"/,
    '1×1 "Kalan" + countdown sit 2dp lower (optical centre), countdown size unchanged');
  assert.doesNotMatch(compact,/android:text="[^"]*(?:[Kk]erahet|KERAHET)/);
  for(const name of ['widget_prayer_row','widget_prayer_column']){
    const xml=read(p+name+suffix+'.xml');
    const short=name==='widget_prayer_row'?'row':'col';
    for(const id of ['logo','brand','remaining'])element(xml,'widget_'+short+'_'+id);
    assert.match(element(xml,'widget_'+short+'_brand'),/android:visibility="gone"/);
    assert.match(element(xml,'widget_'+short+'_remaining'),/android:visibility="gone"/);
    for(let i=0;i<6;i++)element(xml,'widget_'+short+'_icon_'+i);
  }
}
assert.match(read(p+'widget_prayer_row_info.xml'),/targetCellWidth="4"[^>]*targetCellHeight="1"/);
assert.match(read(p+'widget_prayer_row_info.xml'),/resizeMode="horizontal"/);
assert.match(read(p+'widget_prayer_column_info.xml'),/targetCellWidth="1"[^>]*targetCellHeight="4"/);
assert.match(read(p+'widget_prayer_column_info.xml'),/resizeMode="vertical"/);
// Kerahet: ONLY the 1×1 "Kalan" outline changes; it follows the app's rule.
{
  const start=scheduler.indexOf('int[] compact=widgetIds[2];');
  const block=scheduler.slice(start,scheduler.indexOf('int[] focus=widgetIds[3];',start));
  assert.ok(start>0&&block.length>0);
  const literals=block.replace(/\/\/[^\n]*/g,'').match(/"(?:[^"\\\n]|\\.)*"/g)??[];
  assert.ok(literals.length>0&&!literals.some(text=>/kerahet/i.test(text)),
    'the 1×1 never writes kerahet text');
  assert.doesNotMatch(block,/widget_compact_remaining_label/,'the "Kalan" label never changes at runtime');
}
assert.match(scheduler,/setInt\(R\.id\.widget_compact_remaining_row,"setBackgroundResource",kerahat/);
assert.match(scheduler,/boolean kerahat=ready&&props\.optBoolean\("kerahat",false\)/);
assert.match(scheduler,/next\+"\|"\+kerahat/,'1×1 repaints when kerahet starts or ends');
// Responsive: Android 12+ gets one card per launcher-reported size (text
// fitted to that size), the bucket map when no size is reported, and the
// options size below Android 12.
assert.match(scheduler,/for\(SizeF size:reported\)views\.put\(size,rowCard\(context,look,data,\s*bucketFor\(\(int\)size\.getWidth\(\),ROW_WIDTHS\),size\)\)/);
assert.match(scheduler,/for\(SizeF size:reported\)views\.put\(size,columnCard\(context,look,data,\s*bucketFor\(\(int\)size\.getHeight\(\),COLUMN_HEIGHTS\),size\)\)/);
assert.match(scheduler,/views\.put\(new SizeF\(ROW_WIDTHS\[bucket\],40f\),rowCard\(/);
assert.match(scheduler,/views\.put\(new SizeF\(40f,COLUMN_HEIGHTS\[bucket\]\),columnCard\(/);
assert.match(scheduler,/new RemoteViews\(views\)/);
assert.match(scheduler,/OPTION_APPWIDGET_MIN_WIDTH/);
assert.match(scheduler,/OPTION_APPWIDGET_MAX_HEIGHT/);
// The row/column highlight the CURRENT period, like the home screen.
assert.match(scheduler,/current=!ready\?-1:!nextInCurrentDay\?5:nextIndex<0\?-1:\(nextIndex\+5\)%6/);
// Widget Design 10.0 — owner: "all fonts the same", "text inside the boxes
// exactly centred".
// ONE typeface: every widget text follows the system font (OPPO Sans on
// ColorOS). sans-serif-condensed/-medium countdowns fell back to Roboto there,
// so one widget drew in two typefaces. Bold still marks numbers and names.
// Boxes = outlined/filled chips, boxes and cells, plus the strip and premium
// hour cells (highlighted at runtime). The daily rows are table rows (name
// left, clock right), not boxes.
const isBox=node=>/@drawable\/widget_(chip|box|cell)_(dark|light)"/.test(node.attrs)||
  /android:id="@\+id\/widget_(strip|ring_premium)_cell_\d"/.test(node.attrs);
const centresX=gravity=>gravity==='center'||(gravity??'').split('|').includes('center_horizontal');
let boxes=0;
for(const kind of variants){
  for(const suffix of ['','_light']){
    const file=kind+suffix,xml=read(p+file+'.xml');
    assert.doesNotMatch(xml,/android:(fontFamily|typeface|textFontWeight|textAppearance)=/,
      'widget text must use the system font: '+file);
    for(const box of walk(tree(xml))){
      if(!isBox(box))continue;
      boxes++;
      assert.equal(pad(box,'Start'),pad(box,'End'),'box insets must be symmetric (start/end): '+file);
      // The one optical exception (owner feedback): the 1×1 "Kalan" box,
      // whose descender-less pair sits 2dp lower; its total inset is kept.
      if(attr(box,'id')==='@+id/widget_compact_remaining_row')
        assert.ok(pad(box,'Top')===4&&pad(box,'Bottom')===0,'1×1 optical inset: '+file);
      else assert.equal(pad(box,'Top'),pad(box,'Bottom'),'box insets must be symmetric (top/bottom): '+file);
      for(const text of walk(box)){
        if(!/^(TextView|Chronometer)$/.test(text.tag))continue;
        const label=file+' '+(attr(text,'id')??attr(text,'text'));
        const row=text.parent,siblings=row.children;
        if(attr(row,'orientation')==='horizontal'&&siblings.length>1){
          // Side by side only as a content-sized group that a full-width row
          // centres. A weighted neighbour centres the value in the LEFTOVER
          // space ("KALAN" + countdown sat right of centre).
          assert.ok(attr(row,'layout_width')==='match_parent'&&centresX(attr(row,'gravity')),
            'side-by-side texts must form a centred group: '+label);
          for(const member of siblings)
            assert.ok(attr(member,'layout_weight')===undefined&&
              /^(wrap_content|\d+dp)$/.test(attr(member,'layout_width')),
              'a label and a value share a box stacked, or as a content-sized centred group: '+label);
          continue;
        }
        assert.equal(attr(text,'layout_width'),'match_parent','box text must span its box: '+label);
        // Exactly centred, or a label/clock pair hugging their shared edge
        // (label bottom → clock top), which centres the pair as one group.
        const gravity=attr(text,'gravity'),at=siblings.indexOf(text);
        const hug=gravity==='center_horizontal|bottom'&&
            attr(siblings[at+1]??text,'gravity')==='center_horizontal|top'||
          gravity==='center_horizontal|top'&&
            attr(siblings[at-1]??text,'gravity')==='center_horizontal|bottom';
        assert.ok(gravity==='center'||hug,'box text must be centred: '+label+' ('+gravity+')');
      }
    }
  }
}
// 34 boxes per theme: 1×1 2, 2×2 chip 1, daily footer 1, strip 6+1, mini
// chip 1, premium 6+1, slim chip 1, row 6+1, column 6+1.
assert.ok(boxes>=68,'box audit lost coverage ('+boxes+' boxes)');
// Ring frames: the scheduler sizes each square from the chrome around the
// stage, so these constants must follow the layouts (a taller chip with a
// stale constant pushes the ring stroke under the chip).
for(const [name,key] of [['widget_ring_mini','MINI'],['widget_ring_square','SQUARE'],
    ['widget_ring_premium','PREMIUM']]){
  const root=tree(read(p+name+'.xml'));
  const x=pad(root,'Start')+pad(root,'End');
  let y=pad(root,'Top')+pad(root,'Bottom');
  for(const child of root.children)
    y+=dp(child,'layout_marginTop')+dp(child,'layout_height')+dp(child,'layout_marginBottom');
  const java=scheduler.match(new RegExp(key+'_CHROME_X=([\\d.]+)f,'+key+'_CHROME_Y=([\\d.]+)f'));
  assert.ok(java,'Missing '+key+'_CHROME constants');
  assert.equal(Number(java[1]),x,key+'_CHROME_X must equal the layout chrome');
  assert.equal(Number(java[2]),y,key+'_CHROME_Y must equal the layout chrome');
}
// Widget Design 10.1 — owner: "Kalan" and its countdown blue in EVERY
// widget (logo cyan on navy, the light mark's deep azure on ivory), the
// label bold so the small blue text reads at a glance. Nothing repaints
// them at runtime, so the layouts are the whole truth.
let blueCountdowns=0,blueLabels=0;
for(const kind of variants){
  for(const suffix of ['','_light']){
    const file=kind+suffix,xml=read(p+file+'.xml');
    const blue=suffix?'#0C76B4':'#3CC8F5';
    for(const node of walk(tree(xml))){
      const id=attr(node,'id')?.replace('@+id/','')??'';
      if(node.tag==='Chronometer'){
        assert.equal(attr(node,'textColor'),blue,'countdown must be blue: '+file+' '+id);
        assert.doesNotMatch(scheduler,new RegExp('ink\\(card,look,R\\.id\\.'+id+'\\b'),
          'countdown colour is never repainted: '+id);
        blueCountdowns++;
        continue;
      }
      const label=/kalan/i.test(attr(node,'text')??'')||
        ['widget_strip_next','widget_day_footer','widget_row_next','widget_col_next'].includes(id);
      if(!label||node.tag!=='TextView')continue;
      assert.equal(attr(node,'textColor'),blue,'"Kalan" label must be blue: '+file+' '+(id||attr(node,'text')));
      assert.equal(attr(node,'textStyle'),'bold','"Kalan" label must be bold: '+file+' '+(id||attr(node,'text')));
      blueLabels++;
    }
  }
}
assert.equal(blueCountdowns,variants.length*2,'one countdown per widget and theme');
assert.ok(blueLabels>=variants.length*2,'every widget names its countdown');
// Widget Design 11.0 — owner (26.11.2026): "the calendar parts more elegant
// and professional; all fonts the same size". Per-view autosize gave every
// TextView its own size ("Öğle" larger than "İkindi", "1448" larger than
// "17 Cemaziyelahir"). Sibling groups now take ONE size that the scheduler
// fits to the real launcher size (WidgetTypeScale): the widest member is
// measured in the system face and decides for all. The date blocks are
// calendar leaves under a gold rule: gold Hijri, white Gregorian, muted weekday.
const scale=read(p+'WidgetTypeScale.java');
assert.ok(plugin.includes("'WidgetTypeScale.java'"),'CNG missing WidgetTypeScale.java');
const k=name=>{
  const m=scale.match(new RegExp('\\b'+name+'=([\\d.]+)f?[,;]'));
  assert.ok(m,'Missing WidgetTypeScale.'+name);
  return Number(m[1]);
};
const byId=(root,id)=>{
  const node=[...walk(root)].find(x=>attr(x,'id')==='@+id/'+id);
  assert.ok(node,'Missing '+id);
  return node;
};
const weight=node=>Number(attr(node,'layout_weight')??0);
const near=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-6,label+': layout '+a+' ≠ WidgetTypeScale '+b);
const ruleDp=node=>dp(node,'layout_height')+dp(node,'layout_marginTop')+dp(node,'layout_marginBottom');
/** Siblings render alike: the same attributes apart from id, text and (where
 * the design colours them apart) the ink. */
const alike=(nodes,label,ignore=[])=>{
  const norm=n=>n.attrs.replace(new RegExp('android:('+['id','text',...ignore].join('|')+')="[^"]*"','g'),'')
    .replace(/\s+/g,' ').trim();
  assert.equal(new Set(nodes.map(norm)).size,1,label+': siblings differ');
};
const LIGHT={'#F4D392':'#91652D','#F1F7F8':'#163045','#AFC5D4':'#607481'};
let fittedViews=0;
for(const suffix of ['','_light']){
  const ink=hex=>suffix?LIGHT[hex]:hex;
  const leaf=(nodes,inks,label)=>nodes.forEach((n,i)=>{
    assert.equal(attr(n,'textColor'),ink(inks[i]),label+' ink '+i);
    assert.equal(attr(n,'textStyle'),'bold',label+' must be bold');
    assert.equal(attr(n,'autoSizeTextType'),undefined,label+' takes the fitted size');
    assert.equal(attr(n,'maxLines'),'1');
    fittedViews++;
  });
  // 6×1 row: mark, gold rule, "17 Cemaziyelahir", "26 Kasım", "Perşembe".
  const row=tree(read(p+'widget_prayer_row'+suffix+'.xml'));
  const brand=byId(row,'widget_row_brand');
  const [mark,rule,...lines]=brand.children;
  assert.equal(mark.tag,'ImageView');
  assert.equal(attr(rule,'background'),ink('#F4D392'),'gold rule over the row dates');
  assert.deepEqual(lines.map(n=>attr(n,'id')),
    ['@+id/widget_row_hijri','@+id/widget_row_date','@+id/widget_row_weekday']);
  leaf(lines,['#F4D392','#F1F7F8','#AFC5D4'],'row date line');
  alike(lines,'row date lines',['textColor']);
  const names=[0,1,2,3,4,5].map(i=>byId(row,'widget_row_label_'+i));
  names.forEach(n=>{assert.equal(attr(n,'autoSizeTextType'),undefined,'row names take the fitted size');fittedViews++;});
  alike(names,'row names');
  // 1×6 column calendar leaf: mark, rule, 17 / Cemaziyelahir / 26 / Kasım / Perşembe.
  const col=tree(read(p+'widget_prayer_column'+suffix+'.xml'));
  const leafNode=byId(col,'widget_col_brand');
  const [cmark,crule,...rows]=leafNode.children;
  assert.equal(cmark.tag,'ImageView');
  assert.equal(attr(crule,'background'),ink('#F4D392'),'gold rule over the column leaf');
  assert.deepEqual(rows.map(n=>attr(n,'id')),['@+id/widget_col_hijri_day','@+id/widget_col_hijri_month',
    '@+id/widget_col_day','@+id/widget_col_month','@+id/widget_col_weekday']);
  const numerals=[rows[0],rows[2]],captions=[rows[1],rows[3],rows[4]];
  leaf(numerals,['#F4D392','#F1F7F8'],'column day numeral');
  leaf(captions,['#F4D392','#F1F7F8','#AFC5D4'],'column caption');
  alike(numerals,'column numerals',['textColor']);
  alike(captions,'column captions',['textColor']);
  // Strip and premium footers: six names, one fitted size.
  const strip=tree(read(p+'widget_prayer_strip'+suffix+'.xml'));
  const stripNames=[0,1,2,3,4,5].map(i=>byId(strip,'widget_strip_label_'+i));
  const ring=tree(read(p+'widget_ring_premium'+suffix+'.xml'));
  const ringNames=[0,1,2,3,4,5].map(i=>byId(ring,'widget_ring_premium_label_'+i));
  for(const [group,label] of [[stripNames,'strip names'],[ringNames,'premium names']]){
    group.forEach(n=>{assert.equal(attr(n,'autoSizeTextType'),undefined,label+' take the fitted size');fittedViews++;});
    alike(group,label);
  }
  if(suffix)continue;
  // The scheduler's geometry is the dark layouts' geometry.
  const cell=byId(row,'widget_row_cell_0'),remaining=byId(row,'widget_row_remaining');
  near(pad(row,'Start'),k('ROW_PAD'),'row padding');
  near(weight(byId(row,'widget_row_logo')),k('ROW_LOGO'),'row logo weight');
  near(weight(brand),k('ROW_BRAND'),'row date block weight');
  near(weight(remaining),k('ROW_REMAINING'),'row remaining weight');
  near(dp(cell,'layout_marginStart'),k('ROW_GAP'),'row cell gap');
  near(dp(remaining,'layout_marginStart'),k('ROW_GAP'),'row remaining gap');
  near(pad(cell,'Start'),k('ROW_CELL_PAD'),'row cell padding');
  near(pad(cell,'Top'),k('ROW_CELL_PAD'),'row cell padding (top)');
  near(weight(byId(row,'widget_row_label_0'))/cell.children.reduce((s,n)=>s+weight(n),0),
    k('ROW_LABEL_SHARE'),'row name share of a cell');
  near(ruleDp(rule),k('ROW_RULE'),'row rule');
  near(weight(mark),k('ROW_MARK'),'row mark weight');
  lines.forEach(n=>near(weight(n),k('ROW_LINE'),'row date line weight'));
  near(lines.length,k('ROW_LINES'),'row date line count');
  const ccell=byId(col,'widget_col_cell_0'),cremaining=byId(col,'widget_col_remaining');
  near(pad(col,'Start'),k('COL_PAD'),'column padding');
  near(weight(byId(col,'widget_col_logo')),k('COL_LOGO'),'column logo weight');
  near(weight(leafNode),k('COL_BRAND'),'column leaf weight');
  near(weight(cremaining),k('COL_REMAINING'),'column remaining weight');
  near(dp(ccell,'layout_marginTop'),k('COL_GAP'),'column cell gap');
  near(dp(cremaining,'layout_marginTop'),k('COL_GAP'),'column remaining gap');
  near(pad(leafNode,'Start'),k('COL_BRAND_PAD'),'column leaf side padding');
  near(pad(leafNode,'End'),k('COL_BRAND_PAD'),'column leaf side padding (end)');
  near(ruleDp(crule),k('COL_RULE'),'column rule');
  near(weight(cmark),k('COL_MARK'),'column mark weight');
  numerals.forEach(n=>near(weight(n),k('COL_NUMERAL'),'column numeral weight'));
  captions.forEach(n=>near(weight(n),k('COL_CAPTION'),'column caption weight'));
  const [header,stripRule,cells]=strip.children;
  const stripCell=byId(strip,'widget_strip_cell_0'),stripTime=byId(strip,'widget_strip_time_0');
  const footer=byId(strip,'widget_strip_remaining_row');
  near(pad(strip,'Start'),k('STRIP_PAD'),'strip padding');
  near(dp(header,'layout_height'),k('STRIP_HEADER'),'strip header');
  near(ruleDp(stripRule),k('STRIP_RULE'),'strip rule');
  near(dp(cells,'layout_marginBottom'),k('STRIP_CELLS_BOTTOM'),'strip cells margin');
  near(weight(cells),1,'strip cells weight');
  near(dp(footer,'layout_height'),k('STRIP_FOOTER'),'strip footer');
  near(weight(footer),k('STRIP_FOOTER_WEIGHT'),'strip footer weight');
  near(pad(stripCell,'Start'),k('STRIP_CELL_PAD_X'),'strip cell padding');
  near(pad(stripCell,'Top'),k('STRIP_CELL_PAD_Y'),'strip cell padding (top)');
  near(dp(stripTime,'layout_marginTop'),k('STRIP_TIME_GAP'),'strip clock gap');
  near(weight(stripNames[0])/(weight(stripNames[0])+weight(stripTime)),0.8/1.8,'strip name share');
  assert.match(scale,/NAME_SHARE=0\.8f\/1\.8f;/);
  const ringCell=byId(ring,'widget_ring_premium_cell_0'),chip=ringCell.parent;
  const ringClock=byId(ring,'widget_ring_premium_clock_0');
  near(pad(ring,'Start'),k('PREMIUM_PAD'),'premium padding');
  near(dp(chip,'layout_height'),k('PREMIUM_CHIP'),'premium footer chip');
  near(pad(chip,'Start'),k('PREMIUM_CHIP_PAD'),'premium chip padding');
  near(pad(ringCell,'Start'),k('PREMIUM_CELL_PAD_X'),'premium cell padding');
  near(pad(ringCell,'Top'),k('PREMIUM_CELL_PAD_Y'),'premium cell padding (top)');
  near(dp(ringClock,'layout_marginTop'),k('PREMIUM_TIME_GAP'),'premium clock gap');
  near(weight(ringNames[0])/(weight(ringNames[0])+weight(ringClock)),0.8/1.8,'premium name share');
}
// The scheduler applies the fitted size to EVERY member of every group.
for(const pattern of [
  /for\(int label:ROW_LABELS\)\s*card\.setTextViewTextSize\(label,TypedValue\.COMPLEX_UNIT_PX,type\.caption\)/,
  /for\(int line:ROW_DATE_LINES\)\s*card\.setTextViewTextSize\(line,TypedValue\.COMPLEX_UNIT_PX,type\.caption\)/,
  /for\(int numeral:COL_NUMERALS\)\s*card\.setTextViewTextSize\(numeral,TypedValue\.COMPLEX_UNIT_PX,type\.numeral\)/,
  /for\(int caption:COL_CAPTIONS\)\s*card\.setTextViewTextSize\(caption,TypedValue\.COMPLEX_UNIT_PX,type\.caption\)/,
  /float labelSize=WidgetTypeScale\.strip\(context,size,stripNames\(times\)\);\s*for\(int label:labels\)card\.setTextViewTextSize\(label,TypedValue\.COMPLEX_UNIT_PX,labelSize\)/,
  /float labelSize=WidgetTypeScale\.premium\(context,size,stripNames\(times\)\);\s*for\(int label:hourLabels\)\s*card\.setTextViewTextSize\(label,TypedValue\.COMPLEX_UNIT_PX,labelSize\)/,
  /ROW_DATE_LINES=\{R\.id\.widget_row_hijri,R\.id\.widget_row_date,\s*R\.id\.widget_row_weekday\}/,
  /COL_NUMERALS=\{R\.id\.widget_col_hijri_day,R\.id\.widget_col_day\}/,
  /COL_CAPTIONS=\{R\.id\.widget_col_hijri_month,R\.id\.widget_col_month,\s*R\.id\.widget_col_weekday\}/,
  /WidgetTypeScale\.row\(context,size,bucket,remaining,\s*data\.labels,data\.hijriLine\(\),data\.dayLine\(\),data\.weekday\)/,
  /WidgetTypeScale\.column\(context,size,remaining,\s*new String\[\]\{data\.hijriDay,data\.day\},data\.hijriMonth,data\.month,data\.weekday\)/,
])assert.match(scheduler,pattern);
// One measured size for the whole group: the widest member decides.
assert.match(scale,/widest=Math\.max\(widest,paint\.measureText\(text\)\)/);
assert.match(scale,/return Math\.max\(min,Math\.min\(max,Math\.min\(byWidth,byHeight\)\)\)/);
// Resizing the strip refits its names (the row, column and rings already repaint).
assert.match(read(p+'PrayerStripWidgetProvider.java'),
  /onAppWidgetOptionsChanged[\s\S]*"launcher:update:strip"/,'a resized strip refits its names');
// Calendar-leaf dates: day and month without years.
assert.match(scheduler,/new SimpleDateFormat\("d",turkish\)/);
assert.match(scheduler,/new SimpleDateFormat\("MMMM",turkish\)/);
assert.match(scheduler,/static String\[\] hijriParts\(String hijri\)/);
// The daily list keeps per-view autosize, so all six names must fit their
// box at the group maximum even at 130% system font on the smallest 4×2
// (300dp): then all six render at the same size. Widths in em of the
// system regular face (Roboto metrics, as on ColorOS's OPPO Sans).
{
  const em={'İ':.28,k:.5,i:.24,n:.55,d:.56,m:.87,s:.5,a:.54,G:.67,'ü':.55,e:.53,'ş':.5,
    'Ö':.68,'ğ':.56,l:.24,A:.65,Y:.61,t:.33,'ı':.24};
  const width=word=>[...word].reduce((sum,c)=>{assert.ok(em[c],'no width for '+c);return sum+em[c];},0);
  const day=tree(read(p+'widget_prayer_day.xml'));
  const label=byId(day,'widget_day_label_0'),dayRow=label.parent,time=byId(day,'widget_day_time_0');
  const columnWidth=(300-2*pad(day,'Start')-1-5)/2;
  const box=(columnWidth-pad(dayRow,'Start')-pad(dayRow,'End')-dp(byId(day,'widget_day_icon_0'),'layout_width'))*
    weight(label)/(weight(label)+weight(time));
  const max=Number(attr(label,'autoSizeMaxTextSize').replace('sp',''));
  const widest=Math.max(...['İmsak','Güneş','Öğle','İkindi','Akşam','Yatsı'].map(width));
  assert.ok(widest*max*1.3<=box,'daily names diverge at 130% font: '+(widest*max*1.3).toFixed(1)+' > '+box.toFixed(1));
  alike([0,1,2,3,4,5].map(i=>byId(day,'widget_day_label_'+i)),'daily names');
}
console.log('Widget Design 11.0: '+fittedViews+' texts in row, column, strip and premium groups take one '+
  'fitted size each, calendar-leaf dates under a gold rule, scheduler geometry follows the layouts');
console.log('Widget Design 10.1: '+blueCountdowns+' countdowns and '+blueLabels+
  ' "Kalan" labels blue in both themes');
console.log('Widget Design 10.0: one system typeface in every widget, '+boxes+
  ' boxes with exactly centred text and symmetric insets, ring chrome constants follow the layouts');
console.log('Widget Design 9.0: large brand mark, outlined 1×1 with kerahet outline, resizable six-prayer row and column');
console.log('Widget Design 8.0: 11 variants, countdown-first hierarchy, autosized content that fills the launcher cell, ring-proportional centre text and light/dark parity validated');
