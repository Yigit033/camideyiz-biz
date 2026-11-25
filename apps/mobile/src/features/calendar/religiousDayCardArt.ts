/**
 * Artwork of the religious-day share card as plain data, with no React Native
 * import: ReligiousDayCard.tsx draws these exact shapes with react-native-svg
 * and the design preview renders the same list to PNG.
 *
 * Units: a 360-wide design grid. Story 360×640 (9:16) and post 360×450 (4:5)
 * match the Gallery's export formats and scale to 1080 px wide on export.
 * Ornament: an Ottoman pointed niche (mihrab) crowned with an alem finial,
 * köşebent corner medallions and a faint eight-point star lattice, in gold.
 */
import type {GalleryFormat,ReligiousDayMotif} from '@camideyiz/core';

export type CardTone='night'|'ivory';
export const CARD_WIDTH=360;
export const CARD_PALETTE:Record<CardTone,{
  bgTop:string;bgMid:string;bgBottom:string;niche:string;nicheLow:string;
  gold:string;goldText:string;headline:string;muted:string;blessing:string;glow:string;
  logo:'dark'|'light';
}>={
  // Night: the logo's midnight blue with cyan light and gold, never green.
  night:{bgTop:'#0F2C45',bgMid:'#0A2034',bgBottom:'#061321',niche:'#0E2A41',
    nicheLow:'#09192A',gold:'#D8BF8D',goldText:'#E3CB98',headline:'#FFF7E9',
    muted:'#B2C6D6',blessing:'#E8DCC2',glow:'#20B6EB',logo:'dark'},
  // Ivory: the light theme's ivory and emerald with the same gold.
  ivory:{bgTop:'#FBF8F1',bgMid:'#F4EFE4',bgBottom:'#E9E1CF',niche:'#FFFDF8',
    nicheLow:'#F7F1E4',gold:'#A88A5C',goldText:'#8A6B3B',headline:'#152821',
    muted:'#56655D',blessing:'#3D4C45',glow:'#E2BE7E',logo:'light'},
};

type TextBox={top:number;height:number;fontSize:number};
export type CardLayout={
  width:number;height:number;frame:number;
  arch:{left:number;right:number;spring:number;apex:number;base:number};
  motif:{cy:number;scale:number};
  eyebrow:TextBox;
  headline:{top:number;height:number;inset:number;maxFont:number;minFont:number};
  divider:number;hijri:TextBox;gregorian:TextBox;blessing:TextBox;
  logo:{top:number;height:number};
};
export function cardLayout(format:GalleryFormat):CardLayout{
  // Story keeps every word inside WhatsApp's top (~10%) and bottom (~9%) chrome.
  if(format==='story')return {
    width:CARD_WIDTH,height:640,frame:16,
    arch:{left:46,right:314,spring:252,apex:86,base:478},
    motif:{cy:158,scale:1},
    eyebrow:{top:206,height:20,fontSize:10.5},
    headline:{top:230,height:128,inset:72,maxFont:37,minFont:26},
    divider:372,
    hijri:{top:386,height:24,fontSize:16},
    gregorian:{top:411,height:20,fontSize:11.5},
    blessing:{top:438,height:24,fontSize:14},
    logo:{top:498,height:72},
  };
  return {
    width:CARD_WIDTH,height:450,frame:14,
    arch:{left:46,right:314,spring:200,apex:54,base:330},
    motif:{cy:100,scale:.74},
    eyebrow:{top:116,height:18,fontSize:9.5},
    headline:{top:136,height:92,inset:72,maxFont:31,minFont:23},
    divider:236,
    hijri:{top:246,height:22,fontSize:14.5},
    gregorian:{top:268,height:18,fontSize:10.5},
    blessing:{top:292,height:22,fontSize:12.5},
    logo:{top:346,height:62},
  };
}
/** widget-mark-*.png is 384×337; the transparent mark sits on the card. */
export const LOGO_ASPECT=384/337;

/** The serif headline's box in grid units, for core's fitHeadline(). */
export function headlineBox(layout:CardLayout){
  const h=layout.headline;
  return {width:layout.width-2*h.inset,height:h.height,maxFont:h.maxFont,minFont:h.minFont};
}

export type ArtStop={offset:string;color:string;opacity:number};
export type ArtGradient={id:string;type:'linear';x1:string;y1:string;x2:string;y2:string;
  stops:ArtStop[]}|{id:string;type:'radial';cx:string;cy:string;r:string;stops:ArtStop[]};
export type ArtShape={d:string;fill?:string;fillOpacity?:number;stroke?:string;
  strokeWidth?:number;strokeOpacity?:number};
export type CardArt={width:number;height:number;gradients:ArtGradient[];shapes:ArtShape[]};

const f=(n:number)=>String(Math.round(n*100)/100);
const circle=(cx:number,cy:number,r:number)=>
  'M'+f(cx-r)+' '+f(cy)+'A'+f(r)+' '+f(r)+' 0 1 0 '+f(cx+r)+' '+f(cy)+
  'A'+f(r)+' '+f(r)+' 0 1 0 '+f(cx-r)+' '+f(cy)+'Z';
const ellipse=(cx:number,cy:number,rx:number,ry:number)=>
  'M'+f(cx-rx)+' '+f(cy)+'A'+f(rx)+' '+f(ry)+' 0 1 0 '+f(cx+rx)+' '+f(cy)+
  'A'+f(rx)+' '+f(ry)+' 0 1 0 '+f(cx-rx)+' '+f(cy)+'Z';
const lozenge=(cx:number,cy:number,rx:number,ry:number)=>
  'M'+f(cx)+' '+f(cy-ry)+'L'+f(cx+rx)+' '+f(cy)+'L'+f(cx)+' '+f(cy+ry)+'L'+f(cx-rx)+' '+f(cy)+'Z';
/** Eight-point star (two interlaced squares, the Rub el Hizb). */
function star8(cx:number,cy:number,r:number):string{
  const inner=r*Math.cos(Math.PI/4)/Math.cos(Math.PI/8);
  let d='';
  for(let i=0;i<16;i++){
    const a=-Math.PI/2+i*Math.PI/8;const rr=i%2?inner:r;
    d+=(i?'L':'M')+f(cx+rr*Math.cos(a))+' '+f(cy+rr*Math.sin(a));
  }
  return d+'Z';
}
/** Two interlaced squares: the girih lattice's open eight-point star. */
function interlace(cx:number,cy:number,r:number):string{
  const h=r*Math.SQRT1_2;
  return 'M'+f(cx-h)+' '+f(cy-h)+'H'+f(cx+h)+'V'+f(cy+h)+'H'+f(cx-h)+'Z'+
    'M'+f(cx)+' '+f(cy-r)+'L'+f(cx+r)+' '+f(cy)+'L'+f(cx)+' '+f(cy+r)+'L'+f(cx-r)+' '+f(cy)+'Z';
}
/** Four-point sparkle with concave sides. */
function sparkle(cx:number,cy:number,rx:number,ry:number):string{
  const k=.18;
  return 'M'+f(cx)+' '+f(cy-ry)+'Q'+f(cx+rx*k)+' '+f(cy-ry*k)+' '+f(cx+rx)+' '+f(cy)+
    'Q'+f(cx+rx*k)+' '+f(cy+ry*k)+' '+f(cx)+' '+f(cy+ry)+
    'Q'+f(cx-rx*k)+' '+f(cy+ry*k)+' '+f(cx-rx)+' '+f(cy)+
    'Q'+f(cx-rx*k)+' '+f(cy-ry*k)+' '+f(cx)+' '+f(cy-ry)+'Z';
}
/** Crescent: outer disc minus an offset disc; opens towards (ux,uy). */
function crescent(cx:number,cy:number,R:number,r:number,d:number,ux:number,uy:number):string{
  const len=Math.hypot(ux,uy);ux/=len;uy/=len;
  const a=(d*d+R*R-r*r)/(2*d);const h=Math.sqrt(Math.max(0,R*R-a*a));
  const px=-uy,py=ux;
  const p1=[cx+a*ux+h*px,cy+a*uy+h*py],p2=[cx+a*ux-h*px,cy+a*uy-h*py];
  const phi=Math.atan2(h,a-d);
  return 'M'+f(p1[0])+' '+f(p1[1])+'A'+f(R)+' '+f(R)+' 0 1 1 '+f(p2[0])+' '+f(p2[1])+
    'A'+f(r)+' '+f(r)+' 0 '+(2*Math.PI-2*phi>Math.PI?1:0)+' 0 '+f(p1[0])+' '+f(p1[1])+'Z';
}
/** Two-centred pointed arch (sivri kemer); `inset` draws the parallel inner line. */
function archOutline(a:CardLayout['arch'],inset:number,closed:boolean):string{
  const half=(a.right-a.left)/2,mid=a.left+half,rise=a.spring-a.apex;
  // Each side is a circle centred on the springline, through foot and apex.
  // r ≥ half keeps the crown pointed, never notched.
  const r=Math.max(half,(half*half+rise*rise)/(2*half)),ri=r-inset;
  const top=a.spring-Math.sqrt(Math.max(0,ri*ri-(r-half)*(r-half)));
  const L=a.left+inset,R=a.right-inset;
  return 'M'+f(L)+' '+f(a.base)+'L'+f(L)+' '+f(a.spring)+
    'A'+f(ri)+' '+f(ri)+' 0 0 1 '+f(mid)+' '+f(top)+
    'A'+f(ri)+' '+f(ri)+' 0 0 1 '+f(R)+' '+f(a.spring)+
    'L'+f(R)+' '+f(a.base)+(closed?'Z':'');
}
/** Köşebent: a quarter şemse (sun medallion) from a frame corner, as on
 * Ottoman book covers. sx/sy mirror it into each corner. */
function cornerPiece(x:number,y:number,sx:number,sy:number,size:number):string[]{
  const p=(r:number,a:number)=>f(x+sx*r*Math.cos(a))+' '+f(y+sy*r*Math.sin(a));
  const petals=(R:number,count:number,tip:number)=>{
    const step=Math.PI/2/count;let d='M'+p(R,0);
    for(let i=0;i<count;i++){
      const a0=i*step,am=a0+step/2,a1=a0+step;
      d+='C'+p(R*1.16,a0+step*.04)+' '+p(R*tip*.94,am-step*.2)+' '+p(R*tip,am)+
        'C'+p(R*tip*.94,am+step*.2)+' '+p(R*1.16,a1-step*.04)+' '+p(R,a1);
    }
    return d;
  };
  let dots='';
  for(let i=0;i<=6;i++){
    const a=i*Math.PI/12;
    dots+=circle(x+sx*size*.47*Math.cos(a),y+sy*size*.47*Math.sin(a),.9);
  }
  return [
    petals(size*.64,5,1.42)+'L'+p(0,0)+'Z',
    dots,
    petals(size*.26,2,1.32)+'L'+p(0,0)+'Z',
  ];
}
function motifShapes(motif:ReligiousDayMotif,cx:number,cy:number,s:number,
  gold:string,apex:number):ArtShape[]{
  if(motif==='lamp'){
    // A hanging Ottoman mosque lamp (kandil): flared rim, slim neck,
    // round body, foot and tassel, on three chains from the arch's crown.
    const X=(n:number)=>f(cx+n*s),Y=(n:number)=>f(cy+n*s);
    return [
      {d:circle(cx,cy+3*s,27*s),fill:'url(#flame)'},
      {d:'M'+f(cx)+' '+f(apex+10)+'L'+X(0)+' '+Y(-27),stroke:gold,strokeWidth:.8,strokeOpacity:.8},
      {d:circle(cx,cy-25.5*s,1.6*s),fill:'none',stroke:gold,strokeWidth:.8},
      {d:'M'+X(0)+' '+Y(-24)+'L'+X(-11)+' '+Y(-13)+'M'+X(0)+' '+Y(-24)+'L'+X(11)+' '+Y(-13)+
        'M'+X(0)+' '+Y(-24)+'L'+X(0)+' '+Y(-13),stroke:gold,strokeWidth:.6,strokeOpacity:.8},
      {d:'M'+X(-12)+' '+Y(-13)+'L'+X(12)+' '+Y(-13)+'L'+X(5.5)+' '+Y(-6)+'L'+X(-5.5)+' '+Y(-6)+'Z',
        fill:gold,fillOpacity:.92},
      {d:'M'+X(-5.5)+' '+Y(-6)+'C'+X(-17)+' '+Y(-4)+' '+X(-18)+' '+Y(9)+' '+X(-7)+' '+Y(12)+
        'L'+X(7)+' '+Y(12)+'C'+X(18)+' '+Y(9)+' '+X(17)+' '+Y(-4)+' '+X(5.5)+' '+Y(-6)+'Z',
        fill:gold,fillOpacity:.96},
      {d:'M'+X(-14)+' '+Y(1.5)+'L'+X(14)+' '+Y(1.5),stroke:'#FFF4DA',strokeWidth:.6,strokeOpacity:.6},
      {d:circle(cx-7*s,cy+5.5*s,1.1*s)+circle(cx,cy+6*s,1.3*s)+circle(cx+7*s,cy+5.5*s,1.1*s),
        fill:'#FFF4DA',fillOpacity:.8},
      {d:'M'+X(-5)+' '+Y(12)+'L'+X(5)+' '+Y(12)+'L'+X(2.6)+' '+Y(16)+'L'+X(-2.6)+' '+Y(16)+'Z',
        fill:gold,fillOpacity:.92},
      {d:'M'+X(0)+' '+Y(16)+'L'+X(0)+' '+Y(21),stroke:gold,strokeWidth:.7},
      {d:lozenge(cx,cy+24*s,2*s,3.4*s),fill:gold},
    ];
  }
  if(motif==='crescent')return [
    {d:circle(cx,cy,24*s),fill:'url(#flame)'},
    {d:crescent(cx-2*s,cy,15*s,12.5*s,7.5*s,1,-.45),fill:gold},
    {d:star8(cx+10*s,cy-5*s,4.6*s),fill:gold},
  ];
  return [
    {d:circle(cx,cy,26*s),fill:'url(#flame)'},
    {d:star8(cx,cy,17*s),fill:'none',stroke:gold,strokeWidth:1.1},
    {d:star8(cx,cy,11*s),fill:gold,fillOpacity:.9},
    {d:circle(cx,cy,3.2*s),fill:'#FFF3D6',fillOpacity:.85},
  ];
}

export function cardArt(format:GalleryFormat,tone:CardTone,motif:ReligiousDayMotif):CardArt{
  const L=cardLayout(format),P=CARD_PALETTE[tone],W=L.width,H=L.height,a=L.arch;
  const night=tone==='night',mid=W/2;
  const gradients:ArtGradient[]=[
    {id:'cardBg',type:'linear',x1:'0',y1:'0',x2:'0.35',y2:'1',stops:[
      {offset:'0',color:P.bgTop,opacity:1},{offset:'0.55',color:P.bgMid,opacity:1},
      {offset:'1',color:P.bgBottom,opacity:1}]},
    {id:'niche',type:'linear',x1:'0',y1:'0',x2:'0',y2:'1',stops:[
      {offset:'0',color:P.niche,opacity:1},{offset:'1',color:P.nicheLow,opacity:1}]},
    {id:'nicheGlow',type:'radial',cx:'0.5',cy:'0.5',r:'0.5',stops:[
      {offset:'0',color:P.glow,opacity:night?.17:.2},{offset:'1',color:P.glow,opacity:0}]},
    {id:'flame',type:'radial',cx:'0.5',cy:'0.5',r:'0.5',stops:[
      {offset:'0',color:night?'#F3D9A0':'#E9C98C',opacity:night?.42:.38},
      {offset:'1',color:night?'#F3D9A0':'#E9C98C',opacity:0}]},
  ];
  const shapes:ArtShape[]=[{d:'M0 0H'+W+'V'+H+'H0Z',fill:'url(#cardBg)'}];
  // Faint girih lattice on the wall around the niche.
  let lattice='';
  const step=40;
  for(let y=step/2-4;y<H+step;y+=step)for(let x=0;x<=W+step;x+=step){
    const ox=(Math.round((y-step/2+4)/step)%2)?step/2:0;
    lattice+=interlace(x+ox,y,9);
  }
  shapes.push({d:lattice,fill:'none',stroke:P.gold,strokeWidth:.6,strokeOpacity:night?.085:.12});
  // Niche: a plain, softly lit field that keeps the words calm.
  shapes.push({d:archOutline(a,0,true),fill:'url(#niche)'});
  const textMid=(L.headline.top+L.blessing.top+L.blessing.height)/2;
  shapes.push({d:ellipse(mid,textMid,(a.right-a.left)*.56,(a.base-a.apex)*.42),fill:'url(#nicheGlow)'});
  // Frame: double gold rule with corner medallions.
  const o=L.frame,i=o+6;
  shapes.push({d:'M'+o+' '+o+'H'+(W-o)+'V'+(H-o)+'H'+o+'Z',fill:'none',stroke:P.gold,
    strokeWidth:1.1,strokeOpacity:.7});
  shapes.push({d:'M'+i+' '+i+'H'+(W-i)+'V'+(H-i)+'H'+i+'Z',fill:'none',stroke:P.gold,
    strokeWidth:.55,strokeOpacity:.45});
  for(const [x,y,sx,sy] of [[i,i,1,1],[W-i,i,-1,1],[i,H-i,1,-1],[W-i,H-i,-1,-1]] as const){
    const [sun,ring,core]=cornerPiece(x,y,sx,sy,format==='story'?40:33);
    shapes.push({d:sun,fill:P.gold,fillOpacity:night?.08:.1,stroke:P.gold,strokeWidth:.7,strokeOpacity:.8});
    shapes.push({d:ring,fill:P.gold,fillOpacity:.8});
    shapes.push({d:core,fill:P.gold,fillOpacity:.55,stroke:P.gold,strokeWidth:.6});
  }
  // Arch: strong outer line, fine inner line, plinth and alem finial.
  shapes.push({d:archOutline(a,0,false),fill:'none',stroke:P.gold,strokeWidth:1.4,strokeOpacity:.95});
  shapes.push({d:archOutline(a,7,false),fill:'none',stroke:P.gold,strokeWidth:.6,strokeOpacity:.55});
  shapes.push({d:'M'+f(a.left-12)+' '+a.base+'H'+f(a.right+12),stroke:P.gold,strokeWidth:1.2,strokeOpacity:.9});
  shapes.push({d:'M'+f(a.left-4)+' '+(a.base+5)+'H'+f(a.right+4),stroke:P.gold,strokeWidth:.55,strokeOpacity:.55});
  shapes.push({d:lozenge(mid,a.base,6,3.6),fill:P.gold});
  for(const x of [a.left,a.right])shapes.push({d:lozenge(x,a.spring,2.6,4.2),fill:P.gold,fillOpacity:.9});
  const k=format==='story'?1:.78;
  shapes.push({d:'M'+mid+' '+(a.apex-1)+'V'+f(a.apex-27*k),stroke:P.gold,strokeWidth:1.1});
  shapes.push({d:circle(mid,a.apex-9*k,3*k),fill:P.gold});
  shapes.push({d:circle(mid,a.apex-17*k,2.2*k),fill:P.gold});
  shapes.push({d:crescent(mid,a.apex-28*k,5.4*k,4.6*k,2.6*k,0,-1),fill:P.gold});
  shapes.push(...motifShapes(motif,mid,L.motif.cy,L.motif.scale,P.gold,a.apex));
  // Divider between the greeting and the dates.
  const dv=L.divider;
  shapes.push({d:'M'+(mid-62)+' '+dv+'H'+(mid-26)+'M'+(mid-14)+' '+dv+'H'+(mid-11)+
    'M'+(mid+11)+' '+dv+'H'+(mid+14)+'M'+(mid+26)+' '+dv+'H'+(mid+62),
    stroke:P.gold,strokeWidth:.8,strokeOpacity:.8});
  shapes.push({d:sparkle(mid,dv,9,7),fill:P.gold});
  shapes.push({d:lozenge(mid-20,dv,3,2.2)+lozenge(mid+20,dv,3,2.2),fill:P.gold,fillOpacity:.85});
  shapes.push({d:circle(mid-68,dv,1.5)+circle(mid+68,dv,1.5),fill:P.gold,fillOpacity:.8});
  return {width:W,height:H,gradients,shapes};
}
