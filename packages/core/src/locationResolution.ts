/** Exact Turkish province/district resolution for opt-in device GPS.
 * Never choose a neighbouring/centre district via fuzzy substring matches.
 * Reverse-geocoder labels can contain "İlçesi" and ASCII transliterations.
 */
export function normaliseTurkishPlace(value:string):string{
  return value.trim().toLocaleLowerCase('tr-TR')
    // Diyanet's same-name disambiguators: "KALE (M)", "EDREMİT (V)".
    .replace(/\([^)]*\)/g,' ')
    .replace(/ı/g,'i').replace(/ğ/g,'g').replace(/ü/g,'u')
    .replace(/ş/g,'s').replace(/ö/g,'o').replace(/ç/g,'c')
    .replace(/\b(?:province|district|ilcesi|ilce|ili|il)\b/gi,'')
    .replace(/[^a-z0-9]+/g,' ').trim();
}

/** One official name, two spellings: the directory's and the geocoder's. */
const SPELLINGS:Readonly<Record<string,string>>={
  ondokuzmayis:'19mayis',          // Samsun: "19 MAYIS"
  mereglisi:'marmaraereglisi',     // Tekirdağ: "M.EREĞLİSİ"
  eyup:'eyupsultan',               // İstanbul, renamed 2017
  kazan:'kahramankazan',           // Ankara, renamed 2016
};
/** Comparison key: spacing and punctuation never decide a match
 * ("BÜYÜK ORHAN" = "Büyükorhan", "MUSTAFA KEMALPAŞA" = "Mustafakemalpaşa"). */
export function turkishPlaceKey(value:string):string{
  const compact=normaliseTurkishPlace(value).replace(/ /g,'');
  return SPELLINGS[compact]??compact;
}

export type LocationDirectoryRow={id:number;name:string};
export function findExactTurkishPlace<T extends LocationDirectoryRow>(
  candidateNames:readonly (string|null|undefined)[],
  entries:readonly T[],
):T|null{
  for(const label of candidateNames){
    if(typeof label!=='string'||label.length<2)continue;
    const key=turkishPlaceKey(label);
    if(!key)continue;
    const matches=entries.filter(entry=>turkishPlaceKey(entry.name)===key);
    if(matches.length===1)return matches[0];
  }
  return null;
}

/** "PENDİK" → "Pendik", "KALE (M)" → "Kale (M)", "M.EREĞLİSİ" → "M.Ereğlisi". */
export function prettyTurkishPlace(name:string):string{
  return name.trim().toLocaleLowerCase('tr-TR')
    .replace(/(^|[\s\-(.])([^\s\-(.])/g,(_match,edge:string,letter:string)=>
      edge+letter.toLocaleUpperCase('tr-TR'));
}

/**
 * Diyanet publishes ONE calendar for a metropolitan province's urban core,
 * under the province's own name ("İSTANBUL", 9541). The districts carved out
 * of that old central district (Üsküdar, Kadıköy, Çankaya, Konak…) have no
 * entry of their own because that calendar is theirs. Naming them lets
 * people and GPS find them; each resolves to the province-centre ID and
 * never to a neighbouring district. A district Diyanet lists itself always
 * keeps its own entry. Keys are {@link turkishPlaceKey} province names.
 */
export const CENTRAL_DISTRICTS:Readonly<Record<string,readonly string[]>>={
  adana:['Çukurova','Sarıçam','Seyhan','Yüreğir'],
  ankara:['Altındağ','Çankaya','Etimesgut','Gölbaşı','Keçiören','Mamak',
    'Pursaklar','Sincan','Yenimahalle'],
  antalya:['Döşemealtı','Kepez','Konyaaltı','Muratpaşa'],
  aydin:['Efeler'],
  balikesir:['Altıeylül','Karesi'],
  bursa:['Gürsu','Nilüfer','Osmangazi','Yıldırım'],
  denizli:['Merkezefendi','Pamukkale'],
  diyarbakir:['Bağlar','Kayapınar','Sur','Yenişehir'],
  erzurum:['Palandöken','Yakutiye'],
  eskisehir:['Odunpazarı','Tepebaşı'],
  gaziantep:['Şahinbey','Şehitkamil'],
  hatay:['Antakya','Defne'],
  istanbul:['Adalar','Ataşehir','Bağcılar','Bahçelievler','Bakırköy',
    'Bayrampaşa','Beşiktaş','Beykoz','Beyoğlu','Esenler','Eyüpsultan','Fatih',
    'Gaziosmanpaşa','Güngören','Kadıköy','Kağıthane','Sarıyer','Şişli',
    'Ümraniye','Üsküdar','Zeytinburnu'],
  izmir:['Balçova','Bayraklı','Bornova','Buca','Çiğli','Gaziemir',
    'Karabağlar','Karşıyaka','Konak','Narlıdere'],
  kahramanmaras:['Dulkadiroğlu','Onikişubat'],
  kayseri:['Hacılar','Kocasinan','Melikgazi','Talas'],
  kocaeli:['Başiskele','Derince','İzmit'],
  malatya:['Battalgazi'],
  manisa:['Şehzadeler','Yunusemre'],
  mardin:['Artuklu'],
  mersin:['Akdeniz','Mezitli','Toroslar','Yenişehir'],
  mugla:['Menteşe'],
  ordu:['Altınordu'],
  sakarya:['Adapazarı','Arifiye','Erenler','Serdivan'],
  samsun:['Canik','İlkadım'],
  sanliurfa:['Eyyübiye','Haliliye','Karaköprü'],
  tekirdag:['Süleymanpaşa'],
  trabzon:['Ortahisar'],
  van:['İpekyolu','Tuşba'],
};

/**
 * A province's district directory with its central districts named (each
 * a copy of the province-centre row under the district's own name), in
 * Turkish alphabetical order. `gps` also accepts "Merkez", the official name
 * of a non-metropolitan province's central district in reverse geocoding;
 * it is never listed for people to pick.
 */
export function withCentralDistricts<T extends LocationDirectoryRow>(
  provinceName:string,entries:readonly T[],options:{gps?:boolean}={},
):T[]{
  const centre=findExactTurkishPlace([provinceName],entries);
  if(!centre)return [...entries];
  const taken=new Set(entries.map(entry=>turkishPlaceKey(entry.name)));
  const names=[...CENTRAL_DISTRICTS[turkishPlaceKey(provinceName)]??[],
    ...options.gps?['Merkez']:[]];
  const extra=names.filter(name=>!taken.has(turkishPlaceKey(name)))
    .map(name=>({...centre,name}));
  if(!extra.length)return [...entries];
  return [...entries,...extra].sort((a,b)=>
    a.name.toLocaleLowerCase('tr-TR').localeCompare(
      b.name.toLocaleLowerCase('tr-TR'),'tr-TR'));
}

/** Approximate Haversine distance; ONLY a threshold for reducing Android
 * geocoder and network queries, never used to infer a prayer district.
 */
export function locationTravelMeters(
  a:{latitude:number;longitude:number},
  b:{latitude:number;longitude:number},
):number{
  const {latitude:lat1,longitude:lon1}=a;
  const {latitude:lat2,longitude:lon2}=b;
  if(![lat1,lon1,lat2,lon2].every(Number.isFinite)||
    Math.abs(lat1)>90||Math.abs(lat2)>90||
    Math.abs(lon1)>180||Math.abs(lon2)>180)
    throw new RangeError('Invalid coordinates');
  const dLat=(lat2-lat1)*Math.PI/180;
  const dLon=(lon2-lon1)*Math.PI/180;
  const rad1=lat1*Math.PI/180,rad2=lat2*Math.PI/180;
  const aVal=Math.sin(dLat/2)**2+
    Math.cos(rad1)*Math.cos(rad2)*Math.sin(dLon/2)**2;
  return 12742000*Math.asin(Math.min(1,Math.sqrt(Math.max(0,aVal))));
}
