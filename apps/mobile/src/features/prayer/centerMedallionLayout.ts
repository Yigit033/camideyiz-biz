/**
 * Geometry of the dial's stationary centre medallion, as plain numbers.
 * PrayerWheel renders it and scripts/verify-home-visual-contracts.mjs
 * measures it, so the drawing and its contract share one source.
 *
 * Stack lengths are design px on a 366pt dial (× `unit`); ring radii are in
 * the medallion's 220-unit viewBox. Both scale with the dial, so the layout
 * is identical at every dial size.
 */

/** The centre stack is specified in px on a 366pt dial and scales with it. */
export const CENTER_DESIGN_DIAL=366;
/** The medallion is this fraction of the dial, drawn in a 220-unit viewBox. */
export const MEDALLION_FRACTION=.585;
export const MEDALLION_VIEWBOX=220;
/** Gold rings of the medallion (viewBox radii and stroke widths). The dot
 * ring is the innermost gold element: nothing in the stack may reach it. */
export const MEDALLION_RINGS={
  outer:108,inner:104,innerStroke:.8,dots:101,dotRadius:.68,
} as const;

/** Ottoman minaret artwork: its viewBox and where the gold starts (alem
 * tip) and ends (base) vertically. */
export const MINARET_VIEWBOX={width:40,height:96,top:3.2,bottom:95.8} as const;
/** The minaret used to be 44 design px tall inside the stack. It is now the
 * crown of the medallion, 1.5× as tall with the same proportions: the most
 * that leaves the Kerahet stack below it its full height and room. */
export const MINARET_BASE_HEIGHT=44;
export const MINARET_SCALE=1.5;
/** One even breathing gap above the minaret (alem tip to the gold dot ring)
 * and below it (base to the first ornament). */
export const MINARET_BREATH=3;

/** Rows under the minaret: ornament, "<vakit>a Kalan", countdown,
 * [Kerahet], ornament, location (design px). */
export const CENTER_ROWS={
  ornament:10,title:21,countdownGap:1,countdown:36,kerahet:16,location:16,
} as const;
/** One equal gap between those rows; it tightens while the Kerahet line is
 * shown so the taller stack keeps clear of the bottom of the ring. */
export const CENTER_GAP={normal:6.5,kerahet:3} as const;
export const CENTER_STACK_WIDTH=180;

type Box={left:number;top:number;width:number;height:number};
export type CenterMedallionLayout={
  unit:number;
  /** Side of the square medallion. */
  medallion:number;
  minaret:Box;
  stack:Box&{gap:number};
  /** Widest the location row may be: the inner gold ring's chord at the
   * row's lowest edge. */
  locationMaxWidth:number;
};

export function centerMedallionLayout(size:number,kerahet:boolean):CenterMedallionLayout{
  const unit=size/CENTER_DESIGN_DIAL;
  const medallion=size*MEDALLION_FRACTION;
  const ring=medallion/MEDALLION_VIEWBOX;
  const centre=medallion/2;
  const dotRing=(MEDALLION_RINGS.dots-MEDALLION_RINGS.dotRadius)*ring;
  const innerRing=(MEDALLION_RINGS.inner-MEDALLION_RINGS.innerStroke/2)*ring;

  // Anchored to the top of the ring: the alem tip sits one breath below the
  // inner edge of the top gold dot.
  const height=MINARET_BASE_HEIGHT*MINARET_SCALE*unit;
  const width=height*MINARET_VIEWBOX.width/MINARET_VIEWBOX.height;
  const alemTip=centre-dotRing+MINARET_BREATH*unit;
  const minaretTop=alemTip-height*MINARET_VIEWBOX.top/MINARET_VIEWBOX.height;
  const minaretBase=minaretTop+height*MINARET_VIEWBOX.bottom/MINARET_VIEWBOX.height;

  const gap=(kerahet?CENTER_GAP.kerahet:CENTER_GAP.normal)*unit;
  const rows=CENTER_ROWS.ornament*2+CENTER_ROWS.title+CENTER_ROWS.countdownGap+
    CENTER_ROWS.countdown+(kerahet?CENTER_ROWS.kerahet:0)+CENTER_ROWS.location;
  const stackTop=minaretBase+MINARET_BREATH*unit;
  const stackHeight=rows*unit+3*gap;
  const depth=stackTop+stackHeight-centre;
  return {
    unit,medallion,
    minaret:{left:(medallion-width)/2,top:minaretTop,width,height},
    stack:{
      left:(medallion-CENTER_STACK_WIDTH*unit)/2,top:stackTop,
      width:CENTER_STACK_WIDTH*unit,height:stackHeight,gap,
    },
    locationMaxWidth:2*Math.sqrt(Math.max(0,innerRing**2-depth**2)),
  };
}
