import {assertISODate} from './diyanet.ts';

/** Thirty day-pairs from the supplied BirAyetBirHadis.docx (not independently source-verified).
 * The document's explanatory sentence on day 24 is labeled separately from the verse.
 */
export type WisdomKind='verse'|'hadith';
export type WisdomItem={
  id:string;
  kind:WisdomKind;
  day:number;
  text:string;
  reference:string;
  note?:string;
};
export type WisdomPair={day:number;verse:WisdomItem;hadith:WisdomItem};
export const DAILY_WISDOM_PAIRS:readonly WisdomPair[]=[
  {
    "day": 1,
    "verse": {
      "id": "verse-01",
      "kind": "verse",
      "day": 1,
      "text": "“Hem namazı hakkıyla edâ edin, zekâtı verin ve rükû' edenlerle berâber rükû' edin!”",
      "reference": "Bakara Suresi, 43. Ayet-i Celile"
    },
    "hadith": {
      "id": "hadith-01",
      "kind": "hadith",
      "day": 1,
      "text": "1035. Ebu Hüreyre radıyallahu anh’ den rivayet edildiğine göre, Resûlullah sallallahu aleyhi ve sellem şöyle buyurdu:\n\n“İnsanlar ezan okumanın ve namazda birinci safta bulunmanın ne kadar faziletli olduğunu bilselerdi, sonra bunları yapabilmek için kur’a çekmek zorunda kalsalardı kur’a çekerlerdi. Şayet camide cemaate erken yetişmenin ne kadar faziletli olduğunu bilselerdi, birbirleriyle yarışa girerlerdi. Eğer yatsı namazı ile sabah namazındaki fazileti bilselerdi, emekleyerek ve sürünerek de olsa bu iki namaza gelirlerdi.”",
      "reference": "Buhari, Ezan 9, 32, Şehadat 30; Müslim, Salat 129. Ayrıca bk. Tirmizi, Mevakit 52; Nesai, Mevakit 22, Ezan 31"
    }
  },
  {
    "day": 2,
    "verse": {
      "id": "verse-02",
      "kind": "verse",
      "day": 2,
      "text": "“Namazlara devâm ediniz, bilhassa orta namaza! Hem gönülden bağlı kimseler olarak Allah'ın huzûruna durun!”",
      "reference": "Bakara Suresi, 238. Ayet-i Celile"
    },
    "hadith": {
      "id": "hadith-02",
      "kind": "hadith",
      "day": 2,
      "text": "1036. Muaviye radıyallahu anh, Resûllullah sallallahu aleyhi ve sellem’ i:\n\n“Kıyamet günü boyunları en uzun olanlar müezzinlerdir.” buyururken işittim, demişti.",
      "reference": "Müslim, Salat 14. Ayrıca bk. İbni Mace, Ezan 5"
    }
  },
  {
    "day": 3,
    "verse": {
      "id": "verse-03",
      "kind": "verse",
      "day": 3,
      "text": "“Şübhesiz ki îmân edip sâlih ameller işleyenler, namazı hakkıyla edâ edenler ve zekâtı verenler var ya, onların Rableri katında mükâfâtları vardır. Hem onlara hiçbir korku yoktur, onlar mahzun da olmazlar.”",
      "reference": "Bakara Suresi, 277. Ayet-i Celile"
    },
    "hadith": {
      "id": "hadith-03",
      "kind": "hadith",
      "day": 3,
      "text": "1037. Abdullah İbni Abdurrahman İbni Ebu Sa’saa’dan riyavet edildiğine göre, Ebû Saîd elHudrî radıyallahu anh ona şöyle dedi:\n\n“Ben senin koyunu ve kır hayatını sevdiğini görüyorum. Koyunlar arasında veya kırda iken, namaz için ezan okuduğunda sesini iyice yükselt. Çünkü müezzinin sesinin ulaştığı yere kadarki alanda olup da onu işiten cin, insan ve her varlık, kıyamet gününde ezan okuyanın lehine şahitlik yaparlar.”\n\nEbû Saîd: “Ben bunu Resûlullah sallallahu aleyhi ve sellem’den işittim”, dedi.",
      "reference": "Buhârî, Ezân 5, Tevhîd 52, Bed’ü’lhalk. Ayrıca bk. Nesâî, Ezan 14"
    }
  },
  {
    "day": 4,
    "verse": {
      "id": "verse-04",
      "kind": "verse",
      "day": 4,
      "text": "“Ve (sâlih ameller işleyerek) Rabbinizden bir bağışlanmaya ve genişliği göklerle yer(kadar) olan Cennete koşuşun! (Ki orası,) takvâ sâhibleri için hazırlanmıştır.”",
      "reference": "Âl-i İmrân Suresi, 133. Ayet-i Celile"
    },
    "hadith": {
      "id": "hadith-04",
      "kind": "hadith",
      "day": 4,
      "text": "1038. Ebu Hüreyre radıyallahu anh’ den rivayet edildiğine göre, Resûlullah sallallahu aleyhi ve sellem şöyle buyurdu:\n\n“Namaz için ezan okunduğu zaman, şeytan ezanı duymamak için arkasını dönüp yellenerek kaçar. Ezan bitince tekrar geri gelir. Namaz için kamet edilince yine arkasını dönüp kaçar. Kamet bittiğinde yine gelir ve kişi ile nefsi arasına sokulur ve ona: Filan şeyi hatırla, filan şeyi\n\nhatırla diyerek, namazdan önce aklında olmayan şeyleri hatırlatır da, neticede insan kaç rek’at namaz kıldığını bilemez olur.”",
      "reference": "Buhari, Ezan 4, Amel fis’-salat 18, Sehv 6, Bed’ü’l-halk 11; Müzlim, Salat 19, Mesacid 83. Ayrıca bk. Ebu Davud, Salat 31; Nesai, Ezan 20,30"
    }
  },
  {
    "day": 5,
    "verse": {
      "id": "verse-05",
      "kind": "verse",
      "day": 5,
      "text": "“Hem (sen) içlerinde bulunup da onlara namaz kıldırdığın zaman, artık onlardan bir tâife seninle berâber (namaza) dursun; silâhlarını da (yanlarına) alsınlar! Secdeye vardıkları zaman ise hemen (diğer tâife) arkanızda bulunsunlar! Sonra namaz kılmamış olan diğer tâife gelip seninle berâber namaz kılsınlar, hem tedbirlerini hem silâhlarını alsınlar! İnkâr edenler arzu ederler ki silâhlarınızdan ve eşyâlarınızdan gafil olsanız da üzerinize birdenbire baskın yapsalar. Bununla berâber size yağmurdan bir eziyet olur veya hasta olursanız, silâhlarınızı bırakmanızda size bir günah yoktur. Fakat tedbîrinizi alın! Şübhesiz ki Allah, kâfirler için(pek) aşağılayıcı bir azab hazırlamıştır.”",
      "reference": "Nisâ Suresi, 102. Ayet-i Celile"
    },
    "hadith": {
      "id": "hadith-05",
      "kind": "hadith",
      "day": 5,
      "text": "1039. Abdullah İbni Amr İbni Âs radıyallahu anhümâ’dan rivayet edildiğine göre, Resûlullah sallallahu aleyhi ve sellem şöyle buyurdu:\n\n“Ezanı işittiğiniz zaman, müezzinin söylediklerinin aynısını siz de söyleyin. Sonra bana salavat getirin. Çünkü bir kimse bana bir defa salavat getirirse, Allah buna karşılık ona on defa salât eder. Daha sonra benim için Allah’tan vesileyi isteyin. Çünkü vesile, cennette Allah’ın kullarından bir tek kuluna lâyık olan bir makamdır. O kulun ben olacağımı umuyorum. Benim için vesileyi isteyen kimseye şefaatim vacip olur.”",
      "reference": "Müslim, Salat 11. Ayrıca bk. Ebu Davud, Salat 36; Tirmizi, Menakıb 1; Nesai, Ezan 37"
    }
  },
  {
    "day": 6,
    "verse": {
      "id": "verse-06",
      "kind": "verse",
      "day": 6,
      "text": "“Hem (siz ezan okuyarak) namaza çağırdığınız zaman, onu alaya ve eğlenceye alırlar. Bu, şübhesiz onların akıl erdirmeyen bir kavim olmalarındandır.”",
      "reference": "Mâide Suresi, 58. Ayet-i Celile"
    },
    "hadith": {
      "id": "hadith-06",
      "kind": "hadith",
      "day": 6,
      "text": "1040. Ebu Saîd el-Hudrî radıyallahu anh’ den rivayet edildiğine göre, Resûlullah sallallahu aleyhi ve selem şöyle buyurdu:\n\n“Ezanı işittiğiniz zaman siz de müezzinin söylediklerini söyleyiniz.”",
      "reference": "Buhari, Ezan 7; Müslim, Salat 10-11. Ayrıca bk. Tirmizi, Salat 40; Menakıb 1; Nesai, Ezan 33, 35, 37; İbni Mace, Ezan 4"
    }
  },
  {
    "day": 7,
    "verse": {
      "id": "verse-07",
      "kind": "verse",
      "day": 7,
      "text": "“Ve işte bu (Kur'ân), mübârek, kendinden önceki (kitab)ları tasdîk edici olarak, bir de şehirlerin anası (olan Mekke'nin ahâlisi)ni ve etrâfındaki kimseleri korkutasın diye onu(sana) indirdiğimiz bir kitabdır. Ve âhirete îmân edenler, ona (o Kur'ân'a) îmân ederler ve onlar namazlarına devâm ederler.”",
      "reference": "En’âm Suresi, 92. Ayet-i Celile"
    },
    "hadith": {
      "id": "hadith-07",
      "kind": "hadith",
      "day": 7,
      "text": "1041. Cabir radıyallahu anh’ den rivayet edildiğine göre, Resûlullah sallallahu aleyhi ve sellem şöyle buyurdu:\n\n“Kim ezanı işittiği zaman: Ey şu eksiksiz davetin ve kılınacak namazın rabbi Allahım! Muhammed’e vesîleyi ve fazileti ver. Onu, kendisine vaadettiğin makâm-ı mahmûda ulaştır, diye dua ederse, kıyamet gününde o kimseye şefâatim vacip olur.”",
      "reference": "Buhari, Ezan 8, Tefsiru sure(17), 11. Ayrıca bk. Ebu Davud, Salat 37; Tirmizi, Mevakit 43, Nesai, Ezan 38; İbni Mace, Ezan 4"
    }
  },
  {
    "day": 8,
    "verse": {
      "id": "verse-08",
      "kind": "verse",
      "day": 8,
      "text": "De ki: “Şübhesiz benim namazım da ibâdetlerim de hayâtım ve ölümüm de âlemlerin Rabbi olan Allah içindir!”",
      "reference": "En’âm Suresi, 162. Ayet-i Celile"
    },
    "hadith": {
      "id": "hadith-08",
      "kind": "hadith",
      "day": 8,
      "text": "043. Enes radıyallahu anh’ den rivayet edildiğine göre, Resûlullah sallallahu aleyhi ve sellem şöyle buyurdu:\n\n“Ezan ile kamet arasında yapılan dua reddedilmez.”",
      "reference": "Ebu Davud, Salat 35; Tirmizi, Salat 158"
    }
  },
  {
    "day": 9,
    "verse": {
      "id": "verse-09",
      "kind": "verse",
      "day": 9,
      "text": "“Mü'minler ancak o kimselerdir ki, Allah anıldığı zaman kalbleri ürperir; kendilerine O'nun âyetleri okunduğunda (bu, onların) îmanlarını artırır ve (onlar yalnız) Rablerine tevekkül ederler. Onlar ki, namazı hakkıyla edâ ederler ve kendilerini rızıklandırdığımız şeylerden(Allah yolunda) sarf ederler.”",
      "reference": "Enfâl Suresi, 2.-3. Ayetler"
    },
    "hadith": {
      "id": "hadith-09",
      "kind": "hadith",
      "day": 9,
      "text": "1055. Ebû Hüreyre radıyallahu anh’ den rivayet edildiğine göre Nebî sallallahu aleyhi ve sellem şöyle buyurdu:\n\n“Kim sabah akşam camiye gider gelirse, her gidip gelişinde Allah Teâlâ o kimseye cennetteki ikramını hazırlar.”",
      "reference": "Buhârî, Ezân 37; Müslim, Mesâcid 285"
    }
  },
  {
    "day": 10,
    "verse": {
      "id": "verse-10",
      "kind": "verse",
      "day": 10,
      "text": "“Allah'ın mescidlerini, ancak Allah'a ve âhiret gününe îmân eden, namazı hakkıyla edâ eden, zekâtı veren ve Allah'dan başkasından korkmayan kimseler i'mâr eder; işte hidayete erenlerden olmaları umulanlar da onlardır!”",
      "reference": "Tevbe Suresi, 18. Ayet-i Celile"
    },
    "hadith": {
      "id": "hadith-10",
      "kind": "hadith",
      "day": 10,
      "text": "1056. Ebû Hüreyre radıyallahu anh’ den rivayet edildiğine göre, Peygamber sallallahu aleyhi ve sellem şöyle buyurdu:\n\n“Bir kimse evinde güzelce temizlenir, sonra Allah’ın farzlarından bir farzı yerine getirmek için Allah’ın evlerinden birine giderse, attığı adımlardan her biri bir günahı silip yok eder; diğer adımı da onu bir derece yükseltir.”",
      "reference": "Müslim, Mesâcid 282"
    }
  },
  {
    "day": 11,
    "verse": {
      "id": "verse-11",
      "kind": "verse",
      "day": 11,
      "text": "“Mûsâ'ya ve kardeşine: “Kavminiz için Mısır'da evler hazırlayın, evlerinizi namazgâh yapın ve namazı hakkıyla edâ edin! Ve (ey Mûsâ!) Mü'minleri (mükâfâtla)müjdele!” diye vahyettik.”",
      "reference": "Yûnus Suresi, 87. Ayet-i Celile"
    },
    "hadith": {
      "id": "hadith-11",
      "kind": "hadith",
      "day": 11,
      "text": "057. Übey İbni Kâ’b radıyallahu anh şöyle dedi:\n\n– Ensardan bir adam vardı. Evi mescide ondan daha uzak olan bir kimse bilmiyorum. Buna rağmen hiçbir namazı kaçırmıyordu. Kendisine:\n\n– Keşke bir merkep satın alsan! Karanlık ve sıcak günlerde ona binerdin? denildi. Adam:\n\n– Evimin mescide yakın olması beni sevindirmez. Ben mescide gelip giderken attığım her adıma sevap yazılmasını istiyorum, dedi. Bunun üzerine Resûlullah sallallahu aleyhi ve sellem:\n\n– “Allah Teâlâ bunların hepsinin sevabını senin için bir araya topladı” buyurdu.",
      "reference": "Müslim, Mesâcid 278. Ayrıca bk. Ebû Dâvûd, Salât 48"
    }
  },
  {
    "day": 12,
    "verse": {
      "id": "verse-12",
      "kind": "verse",
      "day": 12,
      "text": "“Gündüzün iki tarafında (öğle ve ikindi vakitlerinde) ve gecenin (gündüze) yakın saatlerinde (akşam, yatsı ve sabah vakitlerinde) ise namazı hakkıyla edâ et! Muhakkak ki iyilikler, (büyük günahlardan kaçınmak şartıyla) kötülükleri giderir. Bu, ibret alanlara bir nasîhattir.”",
      "reference": "Hûd Suresi, 114. Ayet-i Celile"
    },
    "hadith": {
      "id": "hadith-12",
      "kind": "hadith",
      "day": 12,
      "text": "1058. Câbir radıyallahu anh şöyle dedi:\n\n– Mescidin etrafındaki arsalar boş kalmıştı. Benî Selime, mescidin yakınına taşınıp yerleşmek istediler. Bu arzu Peygamber sallallahu aleyhi ve sellem’e ulaşınca, onlara:\n\n– “Bana gelen bilgiye göre, mescidin yakınına taşınıp yerleşmek istiyormuşsunuz, öyle mi?” buyurdu. Onlar:\n\n– Evet, ey Allah’ın Resûlü! Böyle arzu etmiştik, dediler. Resûl-i Ekrem iki defa:\n\n– “Ey Selime oğulları! Yurtlarınızdan ayrılmayınız ki, adımlarınıza sevap yazılsın” buyurdu. Onlar da:\n\n– Şu halde yerlerimizden göçmek bizi sevindirmeyecek, dediler.",
      "reference": "Müslim, Mesâcid 280. Ayrıca bk. Tirmizî, Tefsîru sûre(36) 1"
    }
  },
  {
    "day": 13,
    "verse": {
      "id": "verse-13",
      "kind": "verse",
      "day": 13,
      "text": "“Rabbimiz! Doğrusu ben zürriyetimden bir kısmını (oğlum İsmâîl ile annesi Hâcer'i), senin Beyt-i Harâm'ının (Kâ'be'nin) yanında, ekinsiz bir vâdiye yerleştirdim; Rabbimiz! Namazı hakkıyla edâ etsinler (sana hakkıyla kulluk etsinler) diye (emrin üzere, böyle yaptım)! Artık (sen) insanlardan bir kısım gönülleri onlara meylettir ve onları mahsûllerden rızıklandır! Umulur ki şükrederler.”",
      "reference": "İbrâhîm Suresi, 37. Ayet-i Celile"
    },
    "hadith": {
      "id": "hadith-13",
      "kind": "hadith",
      "day": 13,
      "text": "059. Ebû Mûsa radıyallahu anh’ den rivayet edildiğine göre, Resûlullah sallallahu aleyhi ve sellem şöyle buyurdu:\n\n“Şüphesiz namazdan en çok sevap kazanacak insanlar, uzak mesafelerden camiye yürüyerek gelenlerdir. Namazı imamla birlikte kılmak için bekleyen kimsenin sevabı, namazı tek başına kılıp sonra uyuyan kimseden daha büyüktür.”",
      "reference": "Buhârî, Ezân 31; Müslim, Mesâcid 277. Ayrıca bk. Ebû Dâvûd, Salât 48; İbni Mâce, Mesâcid 15"
    }
  },
  {
    "day": 14,
    "verse": {
      "id": "verse-14",
      "kind": "verse",
      "day": 14,
      "text": "“Öyle ise Rabbine hamd ile tesbîh et ve secde edenlerden ol! Ve sana ölüm gelinceye kadar Rabbine kulluk et!”",
      "reference": "Hicr Suresi, 98-99. Ayetler"
    },
    "hadith": {
      "id": "hadith-14",
      "kind": "hadith",
      "day": 14,
      "text": "1060. Büreyde radıyallahu anh’ den rivayet edildiğine göre, Nebî sallallahu aleyhi ve sellem şöyle buyurdu:\n\n“Karanlık gecelerde mescidlere yürüyerek giden kimselere, kıyamet gününde tam bir nura kavuşacaklarını müjdeleyiniz.”",
      "reference": "Ebû Dâvûd, Salât 50; Tirmizî, Salât 166. Ayrıca bk. İbni Mâce, Mesâcid 15"
    }
  },
  {
    "day": 15,
    "verse": {
      "id": "verse-15",
      "kind": "verse",
      "day": 15,
      "text": "“(Öğle üzeri) güneşin zevâlinden (sonra öğle, daha sonra ikindi namazını), gecenin kararmasına kadar (gün batımında akşam, iyice karardığında yatsı) namazı(nı) kıl; bir de sabah namazını (kıl)! Çünki sabah namazı (gece ve gündüz melekleri tarafından) şâhid olunan (bir namaz)dır.”",
      "reference": "İsrâ Suresi, 78. Ayet-i Celile"
    },
    "hadith": {
      "id": "hadith-15",
      "kind": "hadith",
      "day": 15,
      "text": "061. Ebû Hüreyre radıyallahu anh’ den rivayet edildiğine göre, Resûlullah sallallahu aleyhi ve sellem:\n\n– “Size, Allah’ın kendisiyle günahları yok edip, dereceleri yükselteceği hayırları haber vereyim mi?” buyurdular. Ashâb:\n\n– Evet, yâ Resûlallah! dediler. Resûl-i Ekrem:\n\n– “Güçlükler de olsa abdesti güzelce almak, mescidlere doğru çok adım atmak, bir namazı kıldıktan sonra öteki namazı beklemek. İşte ribâtınız, işte bağlanmanız gereken budur” buyurdular.",
      "reference": "Müslim, Tahâret 41. Ayrıca bk. Tirmizî, Tahâret 39; Nesâî, Tahâret 180; İbni Mâce, Tahâret 49, Cihâd 41"
    }
  },
  {
    "day": 16,
    "verse": {
      "id": "verse-16",
      "kind": "verse",
      "day": 16,
      "text": "“Sonra onların ardından yerlerine öyle bir nesil geldi ki namazı zâyi' (terk) ettiler ve şehvetler(in)e uydular; (onlar) artık ileride (Cehennemdeki) Gayyâ Vâdisini boylayacaklardır.”",
      "reference": "Meryem Suresi, 59. Ayet-i Celile"
    },
    "hadith": {
      "id": "hadith-16",
      "kind": "hadith",
      "day": 16,
      "text": "1062. Ebû Saîd el-Hudrî radıyallahu anh’ den rivayet edildiğine göre, Peygamber sallallahu aleyhi ve sellem şöyle buyurdu:\n\n“Mescidlere devam etmeyi alışkanlık haline getiren bir adamı gördüğünüz zaman, onun gerçek mü’min olduğuna şahitlik ediniz”. Allah Taâlâ şöyle buyurur: “Allah’ın mescidlerini, ancak Allah’a ve âhiret gününe inanan, namazı kılan, zekâtı veren ve Allah’tan başka kimseden korkmayanlar onarırlar. İşte onlar, doğru yolu bulanlardan olabilirler” [Tevbe sûresi (9), 18].",
      "reference": "Tirmizî, Îman 8, Tefsîru sûre(9). Ayrıca bk. İbni Mâce, Mesâcid 19"
    }
  },
  {
    "day": 17,
    "verse": {
      "id": "verse-17",
      "kind": "verse",
      "day": 17,
      "text": "“Onlar ki, kendilerine yeryüzünde imkân (iktidar) verdiğimiz takdirde (gafletedalmazlar ve) namazı dosdoğru kılarlar, zekâtı verirler, iyiliği emrederler ve kötülükten men' ederler. (Bütün) işlerin sonu ise Allah'a âiddir.”",
      "reference": "Hac Suresi, 41. Ayet-i Celile"
    },
    "hadith": {
      "id": "hadith-17",
      "kind": "hadith",
      "day": 17,
      "text": "1066. İbni Ömer radıyallahu anhümâ’dan rivayet edildiğine göre, Resûlullah sallallahu aleyhi ve sellem şöyle buyurdu:\n\n“Cemaatle kılınan namaz, tek başına kılınan namazdan yirmi yedi derece daha faziletlidir.”",
      "reference": "Buhârî, Ezân 30; Müslim, Mesâcid 249. Ayrıca bk. Nesâî, İmâmet 42; İbni Mâce, Mesâcid 16"
    }
  },
  {
    "day": 18,
    "verse": {
      "id": "verse-18",
      "kind": "verse",
      "day": 18,
      "text": "“(Onlar) ne bir ticâretin, ne de bir alış-verişin kendilerini Allah'ı anmaktan, namazı dosdoğru kılmaktan ve zekât vermekten alıkoymadığı erlerdir! (Onlar, dehşetten) kalblerin ve gözlerin kendisinde döneceği bir günden korkarlar.”",
      "reference": "Nûr Suresi, 37. Ayet-i Celile"
    },
    "hadith": {
      "id": "hadith-18",
      "kind": "hadith",
      "day": 18,
      "text": "1067. Ebû Hüreyre radıyallahu anh’ den rivayet edildiğine göre, Resûlullah sallallahu aleyhi ve sellem şöyle buyurdu:\n\n“Bir kimsenin cemaatle kıldığı namazın sevabı, evinde ve çarşı pazarda kıldığı namazdan yirmi beş kat daha fazladır. O kimse abdestini güzelce alıp, sonra sadece namaz kılmak maksadıyla\n\nmescide giderse attığı her adım sebebiyle bir derece yükseltilir, bir hatası da silinir. Namazını kıldıktan sonra abdestini bozmadan namaz kıldığı yerde kaldığı müddetçe, melekler ona:\n\nAllahım! Ona rahmetinle muamele et, ona acı! diyerek dua etmeye devam ederler. O kimse namazı beklediği sürece namazda imiş gibidir.”",
      "reference": "Buhârî, Ezân 30; Müslim, Mesâcid 272. Ayrıca bk. Buhârî, Salât 87, Büyû’ 49; Ebû Dâvûd, Salât 48; İbni Mâce, Tahâret 6, Mesâcid 14"
    }
  },
  {
    "day": 19,
    "verse": {
      "id": "verse-19",
      "kind": "verse",
      "day": 19,
      "text": "“O ki, kalktığın zaman seni görür! Secde edenler içinde değişik hâllere girmeni (eğilip doğrulmanı) da (görür)!”",
      "reference": "Şuarâ Suresi, 218-219. Ayetler"
    },
    "hadith": {
      "id": "hadith-19",
      "kind": "hadith",
      "day": 19,
      "text": "1068. Ebû Hüreyre radıyallahu anh’ den rivayet edildiğine göre, Peygamber sallallahu aleyhi ve sellem’e âmâ bir adam gelip:\n\n– Yâ Resûlallah! Beni mescide götürecek bir kimsem yok, diyerek namazı evinde kılabilmek için Resûlullah sallallahu aleyhi ve sellem’den kendisine müsaade etmesini istedi. Peygamber Efendimiz de müsaade etti. Âmâ dönüp giderken Resûl-i Ekrem onu çağırarak:\n\n– “Sen namaz için ezan okunduğunu işitiyor musun?” diye sordu. Âmâ:\n\n– Evet, cevabını verdi. Peygamber aleyhisselâm:\n\n– “O halde davete icâbet et, cemaate gel” buyurdular.",
      "reference": "Müslim, Mesâcid 255. Ayrıca bk. Nesâî, İmâmet 50"
    }
  },
  {
    "day": 20,
    "verse": {
      "id": "verse-20",
      "kind": "verse",
      "day": 20,
      "text": "“(Ey Resûlüm!) Kitab'dan sana vahyedileni oku ve namazı hakkıyla edâ et! Şübhe yok ki namaz, çirkin işlerden ve kötülüklerden (insanı) alıkoyar. (Namaz kılarak) Allah'ı zikretmek ise, elbette (herşeyden) en büyük olandır.(2) Ve Allah, ne yaparsanız bilir.”",
      "reference": "Ankebût Suresi, 45. Ayet-i Celile"
    },
    "hadith": {
      "id": "hadith-20",
      "kind": "hadith",
      "day": 20,
      "text": "069. Kendisine Amr İbni Kays da denilen meşhur müezzin Abdullah İbni Ümmü Mektûm radıyallahu anh :\n\n– Yâ Resûlallah! Muhakkak ki Medine’nin zehirli haşereleri ve yırtıcı hayvanları çoktur, dedi. Resûlullah sallallahu aleyhi ve sellem:\n\n– “Hayye ‘ale’s-salâh, hayye ‘ale’l-felâh’ı işitiyor musun? Öyleyse mescide gel” buyurdu.",
      "reference": "Ebû Dâvûd, Salât 47. Ayrıca bk. Nesâî, İmâmet 50"
    }
  },
  {
    "day": 21,
    "verse": {
      "id": "verse-21",
      "kind": "verse",
      "day": 21,
      "text": "“Öyle ise, akşama girdiğinizde ve sabaha girdiğinizde Allah'ı tesbîh edin (akşam, yatsı ve sabah namazlarını kılın)! Hâlbuki göklerde ve yerde hamd, O'na mahsustur. Akşama doğru ve öğlene girdiğiniz zaman da (Allah'ı tesbîh edin! İkindi ve öğle namazını kılın)!”",
      "reference": "Rûm Suresi, 17-18. Ayetler"
    },
    "hadith": {
      "id": "hadith-21",
      "kind": "hadith",
      "day": 21,
      "text": "1070. Ebû Hüreyre radıyallahu anh’ den rivayet edildiğine göre, Resûlullah sallallahu aleyhi ve sellem şöyle buyurdu:\n\n“Canımı gücü ve kudretiyle elinde tutan Allah’a yemin ederek söylüyorum, içimden öyle geçiyor ki, odun toplamayı emredeyim, odun yığılsın. Sonra namazı emredeyim, ezan okunsun. Daha sonra bir adama cemaate imam olmasını emredeyim. En sonunda cemaate gelmeyen adamlara gidip onlar içindeyken evlerini yakayım.”",
      "reference": "Buhârî, Ahkâm 52, Ezân 29; Müslim, Mesâcid 251-254. Ayrıca bk. Tirmizî, Salât 48; Nesâî, İmâmet 49"
    }
  },
  {
    "day": 22,
    "verse": {
      "id": "verse-22",
      "kind": "verse",
      "day": 22,
      "text": "“Hem hiçbir günahkâr, başkasının günâhını yüklenmez. Artık (günâhı) ağır gelen kimse onu taşımaya (başkalarını) çağırsa ve (bu çağırdığı kimse) akrabâsı bile olsa, ondan (o günâhından) bir şey yüklenmez. (Ey Habîbim!) (Sen) ancak, gıyâben (görmeden)Rablerinden korkanları ve namazı hakkıyla edâ edenleri korkutursun. Artık kim (günahlardan)temizlenirse, o takdirde ancak kendi lehine temizlenmiş olur. Ve (nihâyet) dönüş ancak Allah’adır.”",
      "reference": "Fâtır Suresi, 18. Ayet-i Celile"
    },
    "hadith": {
      "id": "hadith-22",
      "kind": "hadith",
      "day": 22,
      "text": "1071. İbni Mes’ûd radıyallahu anh şöyle dedi:\n\n“Yarın Allah’a müslüman olarak kavuşmak isteyen kimse, şu namazlara ezan okunan yerde devam etsin. Şüphesiz ki Allah Teâlâ sizin peygamberinize hidayet yollarını açıklamıştır. Bu namazlar da hidayet yollarındandır. Şayet siz de cemaati terkedip namazı evinde kılan şu adam gibi namazları evinizde kılacak olursanız, peygamberinizin sünnetini terketmiş olursunuz. Peygamberinizin sünnetini terk ederseniz sapıklığa düşmüş olursunuz. Vallahi ben, nifakı bilinen bir münafıktan başka namazdan geri kalanımız olmadığını görmüşümdür. Allah’a yemin ederim ki, bir adam iki kişi arasında sallanarak namaza getirilir ve safa durdurulurdu”.\n\nMüslim’in bir rivayetinde İbni Mes’ûd şöyle demiştir: “Şüphesiz Resûlullah sallallahu aleyhi ve sellem bize hidayet yollarını öğretmiştir. İçinde ezan okunan mescidde namaz kılmak da hidayet yollarındandır”.",
      "reference": "Müslim, Mesâcid 256-257. Ayrıca bk. Ebû Dâvûd, Salât 46; Nesâî, İmâmet 50; İbni Mâce, Mesâcid 14"
    }
  },
  {
    "day": 23,
    "verse": {
      "id": "verse-23",
      "kind": "verse",
      "day": 23,
      "text": "“Şübhesiz ki bu, elbette büyük kurtuluşun ta kendisidir! Çalışanlar, o hâlde böylesi (bir netîce) için çalışsın!”",
      "reference": "Sâffât Suresi, 60-61. Ayetler"
    },
    "hadith": {
      "id": "hadith-23",
      "kind": "hadith",
      "day": 23,
      "text": "1072. Ebu’d-Derdâ radıyallahu anh şöyle dedi: Resûlullah sallallahu aleyhi ve sellem’ i:\n\n“Bir köy veya kırda üç kişi birlikte bulunur da namazı aralarında cemaatle kılmazlarsa, şeytan onları kuşatıp yener. Şu halde cemaate devam ediniz. Muhakkak ki sürüden ayrılan koyunu kurt yer” buyururken işittim.",
      "reference": "Ebû Dâvûd, Salât 46. Ayrıca bk. Nesâî, İmâmet 48"
    }
  },
  {
    "day": 24,
    "verse": {
      "id": "verse-24",
      "kind": "verse",
      "day": 24,
      "text": "“Rablerinden sakınanlar da bölük bölük Cennete sevk edilmişlerdir. Nihâyet oraya vardıkları zaman, kapıları açılmıştır ve bekçileri onlara: “Selâm size; tertemiz oldunuz! Artık ebediyen kalıcı kimseler olmak üzere buraya girin!” derler.”",
      "reference": "Zümer Suresi, 73. Ayet-i Celile",
      "note": "Belgedeki ek açıklama: (Bölük bölük, cemaat halinde cennet misal camilerin kapılarından tertemiz olarak girin!)"
    },
    "hadith": {
      "id": "hadith-24",
      "kind": "hadith",
      "day": 24,
      "text": "1073. Osman İbni Affân radıyallahu anh şöyle dedi:\n\n– Resûlullah sallallahu aleyhi ve sellem’ i:\n\n“Yatsı namazını cemaatle kılan kimse, gece yarısına kadar namaz kılmış gibidir. Sabah namazını cemaatle kılan kimse ise bütün gece namaz kılmış gibidir”.\n\nMüslim, Mesâcid 260\n\nTirmizî’nin Sünen’deki rivayeti şöyledir:\n\nOsman İbni Affân radıyallahu anh’ den rivayet edildiğine göre, Resûlullah sallallahu aleyhi ve sellem şöyle buyurdu:\n\n“Yatsı namazında cemaatte bulunan kimseye, gecenin yarısına kadar namaz kılmış gibi sevap vardır. Yatsı ve sabah namazlarında cemaatte bulunan kimseye ise, bütün gece namaz kılmış gibi sevap vardır.”",
      "reference": "Tirmizî, Salât 165.Ayrıca bk. Ebû Dâvûd, Salât 47"
    }
  },
  {
    "day": 25,
    "verse": {
      "id": "verse-25",
      "kind": "verse",
      "day": 25,
      "text": "“Ve onlar ki, Rablerin(in da'vetin)e icâbet ederler ve namazı hakkıyla edâ ederler. Onların işleri ise, aralarında şûrâdır (istişâre iledir). Ve (onlar) kendilerini rızıklandırdığımız şeylerden (Allah yolunda) sarf ederler.”",
      "reference": "Şûrâ Suresi, 38. Ayet-i Celile"
    },
    "hadith": {
      "id": "hadith-25",
      "kind": "hadith",
      "day": 25,
      "text": "1074. Ebû Hüreyre radıyallahu anh’ den rivayet edildiğine göre, Resûlullah sallallahu aleyhi ve sellem şöyle buyurdu:\n\n“İnsanlar yatsı namazı ile sabah namazındaki fazilet ve sevabı bilselerdi, emekleyerek bile olsa mutlaka camiye, cemaate gelirlerdi.”",
      "reference": "Buhârî, Ezân 9, 32; Müslim, Salât 129. Ayrıca bk. Tirmizî, Mevâkît 52; Nesâî, Mevâkît 22, Ezân 31"
    }
  },
  {
    "day": 26,
    "verse": {
      "id": "verse-26",
      "kind": "verse",
      "day": 26,
      "text": "Muhammed Allah'ın Resûlüdür. Ve onun berâberinde bulunanlar; kâfirlere karşı çok şiddetli, kendi aralarında gāyet merhametlidirler; onları çokça rükû' eden kimseler ve çokça secde eden kimseler olarak görürsün; (onlar)Allah'dan bir lütuf ve bir rıdvân (sâdece O'nunrızâsını) isterler. Secde eserinden olan alâmetleri, yüzlerindedir. Bu, onların Tevrât'taki vasıflarıdır.\n\nİncîl'deki vasıfları ise, bir ekin gibidir ki filizini çıkarmış, sonra onu kuvvetlendirmiş, sonra kalınlaşmış da gövdesi üzerine dikilmiştir; (bu hâl) ekincilerin hoşuna gider; (onlar hakkındaki bu benzetme) kâfirleri onlarla öfkelendirmek içindir. Allah, onlardan îmân edip sâlih ameller iş leyen lere bir mağfiret ve (pek) büyük bir mükâfât va'd etmiştir.”",
      "reference": "Fetih Suresi, 29. Ayet-i Celile"
    },
    "hadith": {
      "id": "hadith-26",
      "kind": "hadith",
      "day": 26,
      "text": "1075. Ebû Hüreyre radıyallahu anh’ den rivayet edildiğine göre, Resûlullah sallallahu aleyhi ve sellem şöyle buyurdu:\n\n“Münafıklara sabah ve yatsı namazından daha ağır gelen hiçbir namaz yoktur. İnsanlar bu iki namazda ne kadar çok ecir ve sevap olduğunu bilselerdi, emekleyerek de olsa cemaate gelirlerdi.”",
      "reference": "Buhârî, Mevâkît 20, Ezân 34; Müslim, Mesâcid 252. Ayrıca bk. Ebû Dâvûd, Salât 47; Nesâî, İmâmet 45; İbni Mâce, Mesâcid 18"
    }
  },
  {
    "day": 27,
    "verse": {
      "id": "verse-27",
      "kind": "verse",
      "day": 27,
      "text": "“(Ben) cinleri ve insanları, ancak bana ibâdet etsinler diye yarattım! (Ben) onlardan bir rızık istemiyorum; beni doyurmalarını da istemiyorum.”",
      "reference": "Zâriyât Suresi, 56-57. Ayetler"
    },
    "hadith": {
      "id": "hadith-27",
      "kind": "hadith",
      "day": 27,
      "text": "(Mümin) kardeşine tebessüm etmen sadakadır. İyiliği emredip kötülükten sakındırman sadakadır. Yolunu kaybeden kimseye yol göstermen sadakadır. Yoldan taş, diken, kemik gibi şeyleri kaldırıp atman da senin için sadakadır.",
      "reference": "Tirmizî, Birr, 36"
    }
  },
  {
    "day": 28,
    "verse": {
      "id": "verse-28",
      "kind": "verse",
      "day": 28,
      "text": "“Ey îmân edenler! Cum'a günü namaz için seslenildiği (ezan okunduğu) zaman, hemen Allah'ın zikrine koşun ve alış-verişi bırakın! Eğer bilirseniz bu sizin için çok hayırlıdır.”",
      "reference": "Cum’a Suresi, 9. Ayet"
    },
    "hadith": {
      "id": "hadith-28",
      "kind": "hadith",
      "day": 28,
      "text": "\"Her doğan, İslâm fıtratı üzerine doğar. Sonra, anne-babası onu Hristiyan, Yahudi veya Mecusi yapar.\"",
      "reference": "Buhârî, cenâiz 92; Ebû Dâvut, sünne 17; Tirmizî, kader 5"
    }
  },
  {
    "day": 29,
    "verse": {
      "id": "verse-29",
      "kind": "verse",
      "day": 29,
      "text": "“Şübhesiz ki insan, çok hırslı (ve sabırsız) yaratılmıştır! Ona şer dokunduğu zaman, sızlanıcı (feryâd edici)dir! Ona hayır dokunduğu zaman da cimridir (Allah yolunda sarf etmez, şükretmez). Ancak namaz kılanlar müstesnâ. O kimseler ki, onlar, namazlarında devamlıdırlar.”",
      "reference": "Meâric Suresi, 19-23. Ayetler"
    },
    "hadith": {
      "id": "hadith-29",
      "kind": "hadith",
      "day": 29,
      "text": "\"Müslüman, dilinden ve elinden Müslümanların emin olduğu kimsedir. Muhâcir de Allah’ın yasakladığı şeyleri terk edendir.\"",
      "reference": "Buhari, Bedu'l-vahy, 4"
    }
  },
  {
    "day": 30,
    "verse": {
      "id": "verse-30",
      "kind": "verse",
      "day": 30,
      "text": "“Bir kulu namaz kılarken men' edeni gördün mü?”",
      "reference": "Alak Suresi, 9-10. Ayetler"
    },
    "hadith": {
      "id": "hadith-30",
      "kind": "hadith",
      "day": 30,
      "text": "''Hayra vesile olan, hayrı yapan gibidir.''",
      "reference": "Tirmizî, İlim, 14"
    }
  }
];
export const QURAN_SELECTIONS:readonly WisdomItem[]=DAILY_WISDOM_PAIRS.map(p=>p.verse);
export const HADITH_SELECTIONS:readonly WisdomItem[]=DAILY_WISDOM_PAIRS.map(p=>p.hadith);
export const WISDOM_LIBRARY:readonly WisdomItem[]=[...QURAN_SELECTIONS,...HADITH_SELECTIONS];
export type DailyWisdom={dateISO:string;day:number;verse:WisdomItem;hadith:WisdomItem};

// 16 Nov 2026 = day 1, 15 Dec = day 30, 16 Dec = day 1.
// The caller supplies the date in its prayer schedule's time zone.
const CYCLE_START_DAY=Date.parse('2026-11-16T00:00:00.000Z')/86400000;
export function dailyWisdom(dateISO:string):DailyWisdom{
  assertISODate(dateISO);
  const currentDay=Date.parse(dateISO+'T00:00:00.000Z')/86400000;
  if(!Number.isSafeInteger(currentDay))throw new RangeError('Invalid date');
  const index=((currentDay-CYCLE_START_DAY)%DAILY_WISDOM_PAIRS.length+DAILY_WISDOM_PAIRS.length)%DAILY_WISDOM_PAIRS.length;
  const selection=DAILY_WISDOM_PAIRS[index];
  return {dateISO,day:selection.day,verse:selection.verse,hadith:selection.hadith};
}
export function wisdomById(id:string):WisdomItem|null{
  return WISDOM_LIBRARY.find(item=>item.id===id)??null;
}
