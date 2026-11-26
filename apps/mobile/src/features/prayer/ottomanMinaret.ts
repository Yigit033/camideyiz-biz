/**
 * Classical Ottoman minaret (Süleymaniye type): the "time has entered" mark
 * under the medallion's inner gold ring. Plain path data in the 40×96
 * MINARET_VIEWBOX of centerMedallionLayout, so PrayerWheel draws it and the
 * contract script measures exactly the same art.
 *
 * Top to bottom: gilded alem (crescent over two bulbs on a rod), a tall lead
 * pencil külah on a gilt eave, the petek drum with a band of arched windows,
 * three şerefe balconies (pierced railing, floor slab, two staggered rows of
 * muqarnas cells stepping in to the shaft), a slender 16-sided shaft with
 * stone courses, and the pabuç transition onto a moulded base. Drawn for
 * 55–66 px: silhouette first, then only the detail that still reads there.
 */

const CX=20;
const r2=(v:number)=>Math.round(v*100)/100;
type Pt=readonly [number,number];
const poly=(points:readonly Pt[])=>
  'M'+points.map(([x,y])=>r2(x)+' '+r2(y)).join('L')+'Z';
/** Symmetric band: half-width w0 at y0 to half-width w1 at y1. */
const band=(y0:number,y1:number,w0:number,w1=w0)=>
  poly([[CX-w0,y0],[CX+w0,y0],[CX+w1,y1],[CX-w1,y1]]);
const ellipse=(cy:number,rx:number,ry=rx)=>
  'M'+r2(CX-rx)+' '+r2(cy)+'a'+r2(rx)+' '+r2(ry)+' 0 1 0 '+r2(2*rx)+' 0a'+
  r2(rx)+' '+r2(ry)+' 0 1 0 '+r2(-2*rx)+' 0Z';
/** Round-headed opening: window, muqarnas niche. */
const arch=(cx:number,top:number,bottom:number,width:number)=>{
  const r=width/2;
  return 'M'+r2(cx-r)+' '+r2(bottom)+'V'+r2(top+r)+'a'+r2(r)+' '+r2(r)+
    ' 0 0 1 '+r2(width)+' 0V'+r2(bottom)+'Z';
};
const rect=(cx:number,top:number,bottom:number,width:number)=>
  poly([[cx-width/2,top],[cx+width/2,top],[cx+width/2,bottom],[cx-width/2,bottom]]);
const line=(x0:number,y0:number,x1:number,y1:number)=>
  'M'+r2(x0)+' '+r2(y0)+'L'+r2(x1)+' '+r2(y1);
/** Cells spaced evenly round a drum of the given half-width, seen side-on:
 * centre x and foreshortened width; cells turned too far away are dropped. */
function around(radius:number,pitch:number,width:number,stagger=false){
  const step=pitch/radius;
  const cells:{x:number;width:number}[]=[];
  for(let k=-12;k<=12;k++){
    const angle=(k+(stagger?.5:0))*step;
    const facing=Math.cos(angle);
    if(Math.abs(angle)>=Math.PI/2||facing<.34)continue;
    cells.push({x:CX+radius*Math.sin(angle),width:width*facing});
  }
  return cells;
}

export type MinaretFill='lead'|'stone'|'gilt';
const shapes:{fill:MinaretFill;d:string}[]=[];
const cut:string[]=[];        // openings, in the medallion colour
const niches:string[]=[];     // muqarnas cells and recesses (deep shade)
const courses:string[]=[];    // fine stone courses and flutes (soft shade)
const glints:string[]=[];     // lit edges
const drops:string[]=[];      // soft shadow cast under each balcony

/** Alem tip (crescent horns) and the base of the plinth: the gold extent
 * MINARET_VIEWBOX.top / .bottom promise to the layout. */
export const MINARET_ART_TOP=3.2;
export const MINARET_ART_BOTTOM=95.8;

// ── Alem: crescent, horns up, over two bulbs on a rod ─────────────────────
const HORN=2.3;
shapes.push({fill:'gilt',d:'M'+r2(CX-HORN)+' '+MINARET_ART_TOP+'a'+HORN+' '+HORN+
  ' 0 0 0 '+r2(2*HORN)+' 0a2.7 2.7 0 0 1 '+r2(-2*HORN)+' 0Z'});
shapes.push({fill:'gilt',d:band(5.2,6.05,.26,.32)});
shapes.push({fill:'gilt',d:ellipse(6.64,.68,.62)});
shapes.push({fill:'gilt',d:band(7.2,7.52,.32,.4)});
shapes.push({fill:'gilt',d:ellipse(8.45,1.08,.96)});
shapes.push({fill:'gilt',d:band(9.3,10.95,.26,.36)});

// ── Külah: tall lead pencil cone on a gilt eave ───────────────────────────
const KULAH_TIP=9.9,KULAH_BASE=28.3,KULAH=3.55;
shapes.push({fill:'lead',d:poly([[CX,KULAH_TIP],[CX+KULAH,KULAH_BASE],[CX-KULAH,KULAH_BASE]])});
// Lead sheet seams running up to the tip.
for(const x of [-1.8,1.8])courses.push(line(CX+x*.12,KULAH_TIP+1.6,CX+x,KULAH_BASE-.2));
shapes.push({fill:'gilt',d:band(KULAH_BASE-.15,KULAH_BASE+.62,3.85,4.18)});

// ── Petek: drum with a band of arched windows ─────────────────────────────
const PETEK_TOP=KULAH_BASE+.62,PETEK_BOTTOM=33.3,PETEK=3.3;
shapes.push({fill:'stone',d:band(PETEK_TOP,PETEK_BOTTOM,PETEK,PETEK+.08)});
for(const cell of around(PETEK,1.8,.68))
  cut.push(arch(cell.x,PETEK_TOP+.85,PETEK_TOP+2.75,cell.width));
courses.push(line(CX-PETEK,PETEK_TOP+3.3,CX+PETEK,PETEK_TOP+3.3));

// ── Şerefe ×3: pierced railing, floor slab, muqarnas corbels ─────────────
const RAIL=2.1,FLOOR=.62,TIER=1.02,NECK=.85;
type Serefe={top:number;balcony:number;shaft:number};
function serefe({top,balcony,shaft}:Serefe){
  const rail=balcony-.32;
  const floor=top+RAIL,tier1=floor+FLOOR,tier2=tier1+TIER,neck=tier2+TIER;
  const end=neck+NECK;
  const w1=balcony-.2,w2=(balcony+shaft)/2+.12,w3=shaft+.5;
  // Corbels first, so the slab and railing sit crisply on top of them.
  shapes.push({fill:'stone',d:band(tier1,tier2,w1,w1-.32)});
  shapes.push({fill:'stone',d:band(tier2,neck,w2,w2-.3)});
  shapes.push({fill:'stone',d:band(neck,end,w3,shaft)});
  for(const cell of around(w1-.12,.96,.5))
    niches.push(arch(cell.x,tier1+.16,tier2-.04,cell.width));
  for(const cell of around(w2-.12,.96,.5,true))
    niches.push(arch(cell.x,tier2+.14,neck-.04,cell.width));
  shapes.push({fill:'gilt',d:band(floor,tier1,balcony,balcony-.08)});
  glints.push(line(CX-balcony+.25,floor+.12,CX+balcony-.25,floor+.12));
  shapes.push({fill:'gilt',d:band(top,floor,rail)});
  for(const cell of around(rail-.1,.86,.42))
    cut.push(rect(cell.x,top+.48,floor-.44,cell.width));
  drops.push(band(end,end+1.5,shaft+.02,shaft));
  return end;
}

// Shaft: 16-sided, a touch thicker towards the base, with fine courses.
const COURSE=1.85;
function shaft(top:number,bottom:number,w0:number,w1:number){
  shapes.push({fill:'stone',d:band(top,bottom,w0,w1)});
  for(let y=top+COURSE;y<bottom-.6;y+=COURSE){
    const w=w0+(w1-w0)*(y-top)/(bottom-top);
    courses.push(line(CX-w+.12,y,CX+w-.12,y));
  }
  // A few facet edges of the polygonal shaft, faint: flutes, not tiles.
  for(const deg of [-45,-15,15,45]){
    const s=Math.sin(deg*Math.PI/180);
    courses.push(line(CX+w0*s,top+.1,CX+w1*s,bottom-.1));
  }
}

const SEREFE=[
  {top:PETEK_BOTTOM,balcony:5.75,shaft:3.45},
  {top:47.2,balcony:5.95,shaft:3.58},
  {top:61.6,balcony:6.2,shaft:3.72},
] as const;
const below0=serefe(SEREFE[0]);
shaft(below0,SEREFE[1].top,SEREFE[0].shaft,SEREFE[1].shaft-.02);
const below1=serefe(SEREFE[1]);
shaft(below1,SEREFE[2].top,SEREFE[1].shaft,SEREFE[2].shaft-.02);
const below2=serefe(SEREFE[2]);
const PABUC=87.7;
shaft(below2,PABUC,SEREFE[2].shaft,4);

// ── Base: pabuç transition, moulding, kürsü block, plinth ─────────────────
shapes.push({fill:'stone',d:band(PABUC,89.5,4,4.85)});
for(const x of [-2.6,0,2.6])
  niches.push(poly([[CX+x,PABUC+.25],[CX+x+.8,89.35],[CX+x-.8,89.35]]));
shapes.push({fill:'gilt',d:band(89.45,90.15,5.22,5.22)});
shapes.push({fill:'stone',d:band(90.15,94.05,4.9,5)});
niches.push(arch(CX,90.95,93.55,1.4));
shapes.push({fill:'gilt',d:band(94,MINARET_ART_BOTTOM,5.5,5.72)});
glints.push(line(CX-5,94.18,CX+5,94.18));

/** Filled pieces in paint order, each lead, stone or gilt and shaded as a
 * cylinder lit from the left. */
export const MINARET_SHAPES:readonly {fill:MinaretFill;d:string}[]=shapes;
export const MINARET_DETAIL={
  cut:cut.join(''),
  niches:niches.join(''),
  courses:courses.join(''),
  glints:glints.join(''),
  drops:drops.join(''),
} as const;

export const MINARET_FILLS:readonly MinaretFill[]=['lead','stone','gilt'];
/** Gradient stops across every piece: shade, highlight, body, deep shade. */
export const MINARET_STOPS=[0,.3,.58,1] as const;
/** Line weights (viewBox units, ~0.14 px each at 66 px tall) and strengths. */
export const MINARET_STROKE={
  edge:.2,edgeOpacity:.5,course:.16,glint:.2,glintOpacity:.7,dropOpacity:.5,
} as const;
/** Dark: warm-ivory stone, luminous gilt and a silvery lead külah on the
 * midnight medallion. Light: antique gold and bronze with a slate külah, deep
 * enough to hold on ivory. Openings use the medallion colour itself. */
export const MINARET_PALETTE={
  dark:{
    stone:['#A38556','#F7EACB','#E3CC9C','#8B6F45'],
    gilt:['#C08F3C','#FFE7A6','#EDC56F','#A0712A'],
    lead:['#566A80','#BAC6D3','#8394A7','#36465A'],
    edge:'#6E5530',niche:'#5A4426',course:'#7A5F36',glint:'#FFF6DC',
    courseOpacity:.3,nicheOpacity:.6,
  },
  light:{
    stone:['#755829','#D6B676','#B99654','#634822'],
    gilt:['#7C571B','#E0B65F','#BC8E3B','#5E3F10'],
    lead:['#3A4654','#8D99A8','#5C6879','#252E39'],
    edge:'#4A3412',niche:'#3E2C10',course:'#5A4320',glint:'#FFF3D2',
    courseOpacity:.22,nicheOpacity:.62,
  },
} as const;
