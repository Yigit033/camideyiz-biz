import {assertISODate} from './diyanet.ts';

export type ReligiousDayKind='kandil'|'bayram'|'baslangic'|'arefe'|'ozel';
export type ReligiousDay={
 id:string;dateISO:string;title:string;kind:ReligiousDayKind;
 hijri:string;note:string;night:boolean;sourceURL:string;
};
const S26='https://vakithesaplama.diyanet.gov.tr/dinigunler.php?yil=2026';
const S27='https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=154';
const make=(dateISO:string,title:string,kind:ReligiousDayKind,hijri:string,
  note:string,night:boolean,sourceURL:string):ReligiousDay=>({
  id:dateISO+'-'+title.toLocaleLowerCase('tr-TR').replace(/[^a-z0-9ğüşıöç]+/g,'-'),
  dateISO,title,kind,hijri,note,night,sourceURL,
});
/** Diyanet Vakit Hesaplama's 2026/2027 *published* yearly lists.
 * Maintain these curated rows when official list changes; NEVER derive an
 * Islamic festival date from Intl islamic calendar arithmetic.
 */
export const RELIGIOUS_DAYS:readonly ReligiousDay[]=[
 make('2026-01-15','Miraç Kandili','kandil','26 Receb 1447','15 Ocak akşamı idrak edilir.',true,S26),
 make('2026-02-02','Berat Kandili','kandil','14 Şaban 1447','2 Şubat akşamı idrak edilir.',true,S26),
 make('2026-02-19','Ramazan Başlangıcı','baslangic','1 Ramazan 1447','Ramazan ayının ilk günü.',false,S26),
 make('2026-03-16','Kadir Gecesi','kandil','26 Ramazan 1447','16 Mart akşamı idrak edilir.',true,S26),
 make('2026-03-19','Ramazan Bayramı Arefesi','arefe','29 Ramazan 1447','Ramazan Bayramı öncesi arefe.',false,S26),
 ...[20,21,22].map((day,index)=>make('2026-03-'+day,'Ramazan Bayramı · '+(index+1)+'. Gün','bayram',(index+1)+' Şevval 1447','Bayramın '+(index+1)+'. günü.',false,S26)),
 make('2026-05-26','Kurban Bayramı Arefesi','arefe','9 Zilhicce 1447','Kurban Bayramı öncesi arefe.',false,S26),
 ...[27,28,29,30].map((day,index)=>make('2026-05-'+day,'Kurban Bayramı · '+(index+1)+'. Gün','bayram',(10+index)+' Zilhicce 1447','Bayramın '+(index+1)+'. günü.',false,S26)),
 make('2026-06-16','Hicri Yılbaşı','ozel','1 Muharrem 1448','Hicri 1448 yılının başlangıcı.',false,S26),
 make('2026-06-25','Aşure Günü','ozel','10 Muharrem 1448','Muharrem ayının onuncu günü.',false,S26),
 make('2026-08-24','Mevlid Kandili','kandil','11 Rebiülevvel 1448','24 Ağustos akşamı idrak edilir.',true,S26),
 make('2026-12-10','Üç Ayların Başlangıcı','baslangic','1 Receb 1448','Receb, Şaban ve Ramazan aylarının başlangıç dönemi.',false,S26),
 make('2026-12-10','Regaip Kandili','kandil','1 Receb 1448','10 Aralık Perşembe akşamı idrak edilir.',true,S26),
 make('2027-01-04','Miraç Kandili','kandil','26 Receb 1448','4 Ocak Pazartesi akşamı idrak edilir.',true,S27),
 make('2027-01-22','Berat Kandili','kandil','14 Şaban 1448','22 Ocak Cuma akşamı idrak edilir.',true,S27),
 make('2027-02-08','Ramazan Başlangıcı','baslangic','1 Ramazan 1448','Ramazan ayının ilk günü.',false,S27),
 make('2027-03-05','Kadir Gecesi','kandil','26 Ramazan 1448','5 Mart Cuma akşamı idrak edilir.',true,S27),
 make('2027-03-08','Ramazan Bayramı Arefesi','arefe','29 Ramazan 1448','Ramazan Bayramı öncesi arefe.',false,S27),
 ...[9,10,11].map((day,index)=>make('2027-03-'+String(day).padStart(2,'0'),'Ramazan Bayramı · '+(index+1)+'. Gün','bayram',(index+1)+' Şevval 1448','Bayramın '+(index+1)+'. günü.',false,S27)),
 make('2027-05-15','Kurban Bayramı Arefesi','arefe','9 Zilhicce 1448','Kurban Bayramı öncesi arefe.',false,S27),
 ...[16,17,18,19].map((day,index)=>make('2027-05-'+day,'Kurban Bayramı · '+(index+1)+'. Gün','bayram',(10+index)+' Zilhicce 1448','Bayramın '+(index+1)+'. günü.',false,S27)),
 make('2027-06-06','Hicri Yılbaşı','ozel','1 Muharrem 1449','Hicri 1449 yılının başlangıcı.',false,S27),
 make('2027-06-15','Aşure Günü','ozel','10 Muharrem 1449','Muharrem ayının onuncu günü.',false,S27),
 make('2027-08-13','Mevlid Kandili','kandil','11 Rebiülevvel 1449','13 Ağustos Cuma akşamı idrak edilir.',true,S27),
 make('2027-11-29','Üç Ayların Başlangıcı','baslangic','1 Receb 1449','Receb, Şaban ve Ramazan aylarının başlangıç dönemi.',false,S27),
 make('2027-12-02','Regaip Kandili','kandil','4 Receb 1449','2 Aralık Perşembe akşamı idrak edilir.',true,S27),
 make('2027-12-24','Miraç Kandili','kandil','26 Receb 1449','24 Aralık Cuma akşamı idrak edilir.',true,S27),
].sort((a,b)=>a.dateISO.localeCompare(b.dateISO)||a.title.localeCompare(b.title,'tr'));

export function religiousDaysFrom(dateISO:string,year?:number):readonly ReligiousDay[]{
 assertISODate(dateISO);
 return RELIGIOUS_DAYS.filter(d=>d.dateISO>=dateISO&&(year===undefined||d.dateISO.startsWith(year+'-')));
}
export function upcomingReligiousDay(dateISO:string):ReligiousDay|null{
 return religiousDaysFrom(dateISO)[0]??null;
}
export function religiousDayYears():readonly number[]{return [2026,2027];}
