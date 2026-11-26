import {assertISODate} from './diyanet.ts';
import type {ReligiousDay} from './religiousDays.ts';

/** Ornament drawn at the crown of the share card's arch. */
export type ReligiousDayMotif='lamp'|'crescent'|'star';
export type ReligiousDayShareCopy={
  /** The day's own title, set above the greeting (e.g. "Regaip Kandili"). */
  eyebrow:string;
  /** Warm Turkish greeting, the card's headline. */
  headline:string;
  /** One short closing wish under the dates. */
  blessing:string;
  hijri:string;
  /** "10 Aralık 2026 Perşembe", plus "akşamı" for nights observed at dusk. */
  gregorian:string;
  motif:ReligiousDayMotif;
};

const MONTHS=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz',
  'Ağustos','Eylül','Ekim','Kasım','Aralık'] as const;
const WEEKDAYS=['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'] as const;

/** Deterministic Turkish long date, independent of the device's Intl data. */
export function turkishLongDate(dateISO:string):string{
  assertISODate(dateISO);
  const day=new Date(dateISO+'T12:00:00Z');
  return day.getUTCDate()+' '+MONTHS[day.getUTCMonth()]+' '+day.getUTCFullYear()+
    ' '+WEEKDAYS[day.getUTCDay()];
}

/** Turkish capitals without relying on the device's locale tables (i→İ, ı→I). */
export function turkishUpper(text:string):string{
  return text.replace(/i/g,'İ').replace(/ı/g,'I').toUpperCase();
}

/** Best split of a headline into exactly `lines` lines: the longest line as
 * short as possible (ties keep the earlier, rising shape). */
export function splitHeadline(text:string,lines:number):string[]{
  const words=text.trim().split(/\s+/).filter(Boolean);
  const n=Math.max(1,Math.min(lines,words.length));
  if(n===1)return [words.join(' ')];
  let chosen:string[]=[words.join(' ')];let longest=Infinity;
  const split=(start:number,left:number,acc:string[])=>{
    if(left===1){
      const all=[...acc,words.slice(start).join(' ')];
      const max=Math.max(...all.map(l=>l.length));
      if(max<longest){longest=max;chosen=all;}
      return;
    }
    for(let end=start+1;end<=words.length-left+1;end++)
      split(end,left-1,[...acc,words.slice(start,end).join(' ')]);
  };
  split(0,n,[]);
  return chosen;
}

/** Splits a headline into 1–3 typographically balanced lines, so "Kandiliniz
 * mübarek olsun" never leaves a lone "olsun" on the card. */
export function balanceHeadline(text:string,maxLines=3):string[]{
  const words=text.trim().split(/\s+/).filter(Boolean);
  if(words.length<=1||text.trim().length<=12)return [words.join(' ')];
  let best=splitHeadline(text,2);
  for(let lines=2;lines<=Math.min(maxLines,words.length);lines++){
    best=splitHeadline(text,lines);
    if(Math.max(...best.map(l=>l.length))<=(lines===2?19:15))break;
  }
  return best;
}

/** Serif glyphs average ~0.6 em in Noto Serif / Georgia bold. */
const GLYPH_EM=.6;
const LINE_HEIGHT=1.2;
export type HeadlineBox={width:number;height:number;maxFont:number;minFont:number};
function sizeFor(lines:readonly string[],box:HeadlineBox):number{
  const longest=Math.max(...lines.map(l=>Array.from(l).length),1);
  return Math.min(box.maxFont,box.width/(longest*GLYPH_EM),box.height/(lines.length*LINE_HEIGHT));
}
/** Chooses the fewest balanced lines that reach the box's minimum size (the
 * largest size otherwise) and returns them with their font size. */
export function fitHeadline(text:string,box:HeadlineBox):{lines:string[];fontSize:number}{
  const words=text.trim().split(/\s+/).filter(Boolean).length;
  let best={lines:[text.trim()],fontSize:0};
  for(let n=1;n<=Math.min(3,Math.max(1,words));n++){
    const lines=splitHeadline(text,n);
    const fontSize=Math.round(sizeFor(lines,box)*10)/10;
    if(fontSize>best.fontSize)best={lines,fontSize};
    if(fontSize>=box.minFont)return {lines,fontSize};
  }
  return best;
}

/** "Ramazan Bayramı · 2. Gün" → "Ramazan Bayramı": a greeting names the feast. */
function feastName(title:string):string{return title.split(' · ')[0].trim();}

function greeting(day:ReligiousDay):Pick<ReligiousDayShareCopy,'headline'|'blessing'|'motif'>{
  const title=day.title.trim();
  switch(day.kind){
    case 'kandil':
      return /Gecesi$/.test(title)
        ?{headline:title.replace(/Gecesi$/,'Geceniz')+' mübarek olsun',
          blessing:'Dualarınız kabul olsun',motif:'lamp'}
        :{headline:'Kandiliniz mübarek olsun',blessing:'Dualarınız kabul olsun',motif:'lamp'};
    case 'bayram':
      return {headline:'Bayramınız mübarek olsun',blessing:'Nice huzurlu bayramlara',
        motif:'crescent'};
    case 'arefe':
      return {headline:'Arefeniz mübarek olsun',blessing:'Dualarınız kabul olsun',
        motif:'crescent'};
    case 'baslangic':
      if(/^Üç Ay/.test(title))
        return {headline:'Üç Aylar başlıyor',blessing:'Rahmet ve bereketle dolsun',
          motif:'crescent'};
      if(/^Ramazan/.test(title))
        return {headline:'Hoş geldin Ramazan',blessing:'Hayırlı Ramazanlar',motif:'crescent'};
      return {headline:title.replace(/\s+Başlangıcı$/,'')+' başlıyor',
        blessing:'Hayırlara vesile olsun',motif:'crescent'};
    case 'ozel':
      if(/^Hicri Yılbaşı/.test(title))
        return {headline:'Hicri yeni yılınız mübarek olsun',
          blessing:'Yeni yıl hayırlar getirsin',motif:'star'};
      if(/^Aşure/.test(title))
        return {headline:'Aşure Gününüz mübarek olsun',
          blessing:'Bolluk ve bereket getirsin',motif:'star'};
      return {headline:title+' mübarek olsun',blessing:'Hayırlara vesile olsun',motif:'star'};
  }
}

/** Text of the branded share card for one published religious day. Derived
 * only from the curated row: the date and Hijri line are never recomputed.
 */
export function religiousDayShareCopy(day:ReligiousDay):ReligiousDayShareCopy{
  const {headline,blessing,motif}=greeting(day);
  return {
    eyebrow:day.kind==='bayram'?feastName(day.title):day.title.trim(),
    headline,blessing,hijri:day.hijri,motif,
    gregorian:turkishLongDate(day.dateISO)+(day.night?' akşamı':''),
  };
}
