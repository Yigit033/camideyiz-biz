const modules=[
  ['Ayet ve Hadis','Kaynak ve editör onay süreci'],
  ['Galeri','Fotoğraf hakları ve paylaşım şablonları'],
  ['Yayın Takvimi','Günlük içerik planlama'],
  ['Sponsor','Kontrollü görünürlük']
];
export default function Home(){
  return <main className="container">
    <header className="masthead"><div className="symbol">◈</div><span>CAMİDEYİZ BİZ</span></header>
    <p className="eyebrow">YÖNETİM ALTYAPISI · PROTOTİP</p>
    <h1>İçeriklerinizi zarafetle yönetin.</h1>
    <p className="description">Bu ekran yalnızca tasarım ve proje iskeletidir. Kimlik doğrulama, yetki modeli, veritabanı bağlantısı ve içerik düzenleme henüz aktif değildir. Production'a deploy etmeyin.</p>
    <section className="grid">{modules.map(([title,detail],i)=><article className="card" key={title}>
      <span className="index">{'0'+(i+1)}</span><h2>{title}</h2><p>{detail}</p><span className="status">Planlandı</span>
    </article>)}</section>
    <footer>Camideyiz Biz · Zümrüt / fildişi tasarım sistemi</footer>
  </main>;
}
