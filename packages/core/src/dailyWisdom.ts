import {assertISODate} from './diyanet.ts';

/**
 * Locally shipped, manually source-checked EXCERPTS; NOT full Qur'an verses or
 * full hadith texts. The full context is available at the original publisher.
 * This avoids user-generated or unaudited theological content.
 */
export type WisdomKind='verse'|'hadith';
export type WisdomItem={
  id:string;
  kind:WisdomKind;
  category:string;
  excerpt:string;
  reference:string;
  sourceEdition:string;
  sourceUrl:string;
  note:string; // Editorial explanation, NEVER presented as scripture.
};
export const QURAN_SELECTIONS:readonly WisdomItem[]=[
 {id:'quran-nisa-103',kind:'verse',category:'Namaz',excerpt:'Şüphe yok ki namaz, müminler üzerine vakitleri belli olarak yazılmış bir ödevdir.',
  reference:'Nisâ 4:103',sourceEdition:'Diyanet · Kur’an Yolu meali',sourceUrl:'https://kuran.diyanet.gov.tr/tefsir/Nis%C3%A2-suresi/596/103-ayet-tefsiri',
  note:'Namazın vakitleriyle ilgili ayetin kısa bir bölümüdür. Tam anlam ve bağlam için meale bakınız.'},
 {id:'quran-bakara-153',kind:'verse',category:'Sabır',excerpt:'Sabrederek ve namaz kılarak Allah’tan yardım dileyin.',
  reference:'Bakara 2:153',sourceEdition:'Diyanet · İşleri Başkanlığı meali',
  sourceUrl:'https://kuran.diyanet.gov.tr/mushaf/kuran-tefsir-1/bakara-suresi-2/ayet-153/diyanet-isleri-baskanligi-meali-1',
  note:'Ayetin sabır ve namazla yardım istemeyi hatırlatan kısa bölümüdür.'},
 {id:'quran-insirah-5',kind:'verse',category:'Ümit',excerpt:'Demek ki zorlukla beraber bir kolaylık vardır.',
  reference:'İnşirâh 94:5',sourceEdition:'Diyanet · Kur’an Yolu meali',sourceUrl:'https://kuran.diyanet.gov.tr/tefsir/%C4%B0n%C5%9Fir%C3%A2h-suresi/6095/5-8-ayet-tefsiri',
  note:'Zorluk ve kolaylığa dair ayetin tam çevirisi ve tefsirine kaynakta ulaşılabilir.'},
 {id:'quran-zumer-53',kind:'verse',category:'Rahmet',excerpt:'Allah’ın rahmetinden ümit kesmeyin.',
  reference:'Zümer 39:53',sourceEdition:'Diyanet · Kur’an Yolu meali',sourceUrl:'https://kuran.diyanet.gov.tr/tefsir/Z%C3%BCmer-suresi/4111/53-ayet-tefsiri',
  note:'Ayetin rahmet ve bağışlanma çağrısından kısa bir bölümdür; tamamını bağlamıyla okuyunuz.'},
 {id:'quran-hucurat-13',kind:'verse',category:'Ahlak',excerpt:'Allah katında en değerli olanınız O’na itaatsizlikten en fazla sakınanınızdır.',
  reference:'Hucurât 49:13',sourceEdition:'Diyanet · Kur’an Yolu meali',
  sourceUrl:'https://kuran.diyanet.gov.tr/tefsir/Hucur%C3%A2t-suresi/4625/13-ayet-tefsiri',
  note:'Ayetin insanın değer ölçüsünü bildiren kısa kısmıdır.'},
 {id:'quran-nahl-90',kind:'verse',category:'Adalet',excerpt:'Muhakkak ki Allah, adaleti, iyiliği, akrabaya yardım etmeyi emreder.',
  reference:'Nahl 16:90',sourceEdition:'Diyanet · DİB meali',
  sourceUrl:'https://kuran.diyanet.gov.tr/kuran?ayet=91&mode=tefsir&sure=16',
  note:'Ayetin adalet ve iyilikle ilgili ilk bölümüdür; ayetteki yasaklara da tam metinden bakınız.'},
 {id:'quran-rad-28',kind:'verse',category:'Huzur',excerpt:'Biliniz ki, kalpler ancak Allah’ı anmakla huzur bulur.',
  reference:'Ra’d 13:28',sourceEdition:'Diyanet · İşleri Başkanlığı meali',
  sourceUrl:'https://kuran.diyanet.gov.tr/mushaf/tefsir-2/rad-suresi-13/ayet-14/diyanet-isleri-baskanligi-meali-1',
  note:'Ayetin zikrin kalbe huzur verdiğini anlatan kısa bölümüdür.'},
 {id:'quran-taha-114',kind:'verse',category:'İlim',excerpt:'Rabbim, benim ilmimi artır.',
  reference:'Tâhâ 20:114',sourceEdition:'Diyanet · DİB meali',
  sourceUrl:'https://kuran.diyanet.gov.tr/kuran?ayet=114&mode=tefsir&sure=20',
  note:'Ayetin sonundaki ilim duasının kısa alıntısıdır.'},
 {id:'quran-ibrahim-7',kind:'verse',category:'Şükür',excerpt:'Andolsun, eğer şükrederseniz elbette size nimetimi artırırım.',
  reference:'İbrâhîm 14:7',sourceEdition:'Diyanet · DİB meali',
  sourceUrl:'https://kuran.diyanet.gov.tr/mushaf/tefsir-2/ibrahim-suresi-14/ayet-1/diyanet-isleri-baskanligi-meali-1',
  note:'Ayetin şükürle ilgili kısa kısmıdır.'},
 {id:'quran-fussilet-34',kind:'verse',category:'İyilik',excerpt:'İyilikle kötülük bir olmaz.',
  reference:'Fussilet 41:34',sourceEdition:'Diyanet · DİB meali',
  sourceUrl:'https://kuran.diyanet.gov.tr/kuran?ayet=33&mode=kuran-meal&sure=41',
  note:'Ayetin kötülüğe karşı güzel davranışı anlatan bağlamına kaynakta ulaşabilirsiniz.'},
 {id:'quran-maide-2',kind:'verse',category:'Yardımlaşma',excerpt:'İyilik ve takvâ hususunda yardımlaşın, günah ve haksızlık yolunda yardımlaşmayın.',
  reference:'Mâide 5:2',sourceEdition:'Diyanet · Kur’an Yolu meali',
  sourceUrl:'https://kuran.diyanet.gov.tr/tefsir/M%C3%A2ide-suresi/671/2-ayet-tefsiri',
  note:'Ayetin yardımlaşmayla ilgili bir bölümüdür; tamamı daha kapsamlı hükümler içerir.'},
 {id:'quran-insirah-8',kind:'verse',category:'Yöneliş',excerpt:'Ve yalnız rabbine yönel.',
  reference:'İnşirâh 94:8',sourceEdition:'Diyanet · Kur’an Yolu meali',
  sourceUrl:'https://kuran.diyanet.gov.tr/tefsir/%C4%B0n%C5%9Fir%C3%A2h-suresi/6095/5-8-ayet-tefsiri',
  note:'Surenin son ayetinden kısa bir alıntıdır.'},
];
export const HADITH_SELECTIONS:readonly WisdomItem[]=[
 {id:'hadith-intent',kind:'hadith',category:'Niyet',excerpt:'Ameller niyete göredir.',
  reference:'Buhârî, Bed’ü’l-vahy, 1',sourceEdition:'Diyanet · Hadislerle İslâm, Cilt 3, s.21',
  sourceUrl:'https://hadislerleislam.diyanet.gov.tr/pdf/hadislerle_islam_cilt3.pdf',
  note:'Hadisin başlangıcından kısa bir alıntıdır. Tam metin, niyeti ve hicreti daha geniş açıklar.'},
 {id:'hadith-harm',kind:'hadith',category:'Ahlak',excerpt:'Müslüman, elinden ve dilinden Müslümanların selâmette olduğu (zarar görmediği) kimsedir.',
  reference:'Buhârî, Îmân, 4',sourceEdition:'Diyanet · Hadislerle İslâm, Cilt 7, s.25',
  sourceUrl:'https://hadislerleislam.diyanet.gov.tr/sayfa.php?CILT=7&SAYFA=25',
  note:'Hadisin Müslümanların güven içinde yaşamasıyla ilgili kısmıdır.'},
 {id:'hadith-hearts',kind:'hadith',category:'Samimiyet',excerpt:'Allah sizin suretlerinize ve mallarınıza bakmaz, ancak kalplerinize ve amellerinize bakar.',
  reference:'Müslim, Birr, 34',sourceEdition:'Diyanet · Hadislerle İslâm, Cilt 3, s.128',
  sourceUrl:'https://hadislerleislam.diyanet.gov.tr/sayfa.php?CILT=3&SAYFA=128',
  note:'İbadet ve davranışta samimiyeti vurgulayan bir rivayettir.'},
 {id:'hadith-ease',kind:'hadith',category:'Ölçülülük',excerpt:'Din kolaylıktır.',
  reference:'Buhârî, Îmân, 29',sourceEdition:'Diyanet · Hadislerle İslâm, Cilt 1, s.357',
  sourceUrl:'https://hadislerleislam.diyanet.gov.tr/sayfa.php?CILT=1&SAYFA=357',
  note:'Aşırılıktan sakındıran daha uzun bir hadisin başlangıcından alıntıdır.'},
 {id:'hadith-kindness',kind:'hadith',category:'İyilik',excerpt:'Güzel söz ve namaza giderken atılan her adım sadakadır. Yol göstermek sadakadır.',
  reference:'Buhârî, Cihâd, 72',sourceEdition:'Diyanet · Hadislerle İslâm, Cilt 2, s.23',
  sourceUrl:'https://hadislerleislam.diyanet.gov.tr/sayfa.php?CILT=2&SAYFA=23',
  note:'Hadisin günlük iyiliklere örnek veren kısa bölümüdür.'},
 {id:'hadith-hope',kind:'hadith',category:'Ümit',excerpt:'Müminin durumu ne hoştur! Allah’ın takdir ettiği her şey mutlaka onun hayrına olur.',
  reference:'İbn Hanbel, V, 25',sourceEdition:'Diyanet · Hadislerle İslâm, Cilt 3, s.169',
  sourceUrl:'https://hadislerleislam.diyanet.gov.tr/sayfa.php?CILT=3&SAYFA=169',
  note:'Müminin sıkıntı ve sevinç karşısındaki tutumunu anlatan rivayetden alıntıdır.'},
 {id:'hadith-speech',kind:'hadith',category:'Söz',excerpt:'Her kim Allah’a ve âhiret gününe inanıyorsa, ya hayır söylesin ya da sussun…',
  reference:'Buhârî, Rikâk, 23',sourceEdition:'Diyanet · Hadislerle İslâm, Cilt 3, s.371',
  sourceUrl:'https://hadislerleislam.diyanet.gov.tr/sayfa.php?CILT=3&SAYFA=371',
  note:'Güzel ve sorumlu konuşmayı öğütleyen rivayetten kısa bir bölümdür.'},
];
export const WISDOM_LIBRARY:readonly WisdomItem[]=[
  ...QURAN_SELECTIONS,...HADITH_SELECTIONS,
];

export type DailyWisdom={dateISO:string;verse:WisdomItem;hadith:WisdomItem};
/** Stable local-calendar daily selection, no API, account, database or randomness. */
export function dailyWisdom(dateISO:string):DailyWisdom{
  assertISODate(dateISO);
  const day=Math.floor(Date.parse(dateISO+'T00:00:00.000Z')/86400000);
  if(!Number.isSafeInteger(day))throw new RangeError('Invalid date');
  return {
    dateISO,
    verse:QURAN_SELECTIONS[((day+3)%QURAN_SELECTIONS.length+QURAN_SELECTIONS.length)%QURAN_SELECTIONS.length],
    hadith:HADITH_SELECTIONS[((day+1)%HADITH_SELECTIONS.length+HADITH_SELECTIONS.length)%HADITH_SELECTIONS.length],
  };
}
export function wisdomById(id:string):WisdomItem|null{
  return WISDOM_LIBRARY.find(item=>item.id===id)??null;
}
