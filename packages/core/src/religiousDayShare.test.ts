import test from 'node:test';
import assert from 'node:assert/strict';
import {RELIGIOUS_DAYS} from './religiousDays.ts';
import {balanceHeadline,fitHeadline,religiousDayShareCopy,splitHeadline,turkishLongDate,turkishUpper} from './religiousDayShare.ts';

const find=(dateISO:string,title:string)=>{
  const day=RELIGIOUS_DAYS.find(d=>d.dateISO===dateISO&&d.title===title);
  assert.ok(day,dateISO+' '+title);
  return day;
};

test('share card headlines are warm Turkish greetings per kind',()=>{
  const uc=religiousDayShareCopy(find('2026-12-10','Üç Ayların Başlangıcı'));
  assert.equal(uc.headline,'Üç Aylar başlıyor');
  assert.equal(uc.eyebrow,'Üç Ayların Başlangıcı');
  assert.equal(uc.gregorian,'10 Aralık 2026 Perşembe');
  assert.equal(uc.hijri,'1 Receb 1448');

  const regaip=religiousDayShareCopy(find('2026-12-10','Regaip Kandili'));
  assert.equal(regaip.headline,'Kandiliniz mübarek olsun');
  assert.equal(regaip.motif,'lamp');
  assert.equal(regaip.gregorian,'10 Aralık 2026 Perşembe akşamı');

  const kadir=religiousDayShareCopy(find('2027-03-05','Kadir Gecesi'));
  assert.equal(kadir.headline,'Kadir Geceniz mübarek olsun');
  assert.equal(kadir.gregorian,'5 Mart 2027 Cuma akşamı');

  const bayram=religiousDayShareCopy(find('2027-05-17','Kurban Bayramı · 2. Gün'));
  assert.equal(bayram.headline,'Bayramınız mübarek olsun');
  assert.equal(bayram.eyebrow,'Kurban Bayramı');
  assert.equal(bayram.hijri,'11 Zilhicce 1448');

  assert.equal(religiousDayShareCopy(find('2027-02-08','Ramazan Başlangıcı')).headline,
    'Hoş geldin Ramazan');
  assert.equal(religiousDayShareCopy(find('2027-03-08','Ramazan Bayramı Arefesi')).headline,
    'Arefeniz mübarek olsun');
  assert.equal(religiousDayShareCopy(find('2027-06-06','Hicri Yılbaşı')).headline,
    'Hicri yeni yılınız mübarek olsun');
  assert.equal(religiousDayShareCopy(find('2027-06-15','Aşure Günü')).headline,
    'Aşure Gününüz mübarek olsun');
});

test('every published day yields a short, complete card',()=>{
  for(const day of RELIGIOUS_DAYS){
    const copy=religiousDayShareCopy(day);
    for(const value of Object.values(copy))assert.ok(value.trim().length>0,day.id);
    // The card's type scale is tuned for these bounds.
    assert.ok(copy.headline.length<=34,copy.headline);
    assert.ok(copy.eyebrow.length<=26,copy.eyebrow);
    assert.ok(copy.blessing.length<=28,copy.blessing);
    assert.equal(copy.hijri,day.hijri,'Hijri line is the published row, never recomputed');
    assert.ok(copy.gregorian.startsWith(turkishLongDate(day.dateISO)));
    assert.equal(copy.gregorian.endsWith(' akşamı'),day.night);
  }
});

test('Turkish long dates do not depend on device Intl data',()=>{
  assert.equal(turkishLongDate('2026-02-19'),'19 Şubat 2026 Perşembe');
  assert.equal(turkishLongDate('2027-01-04'),'4 Ocak 2027 Pazartesi');
  assert.equal(turkishLongDate('2026-11-29'),'29 Kasım 2026 Pazar');
  assert.throws(()=>turkishLongDate('2026-13-01'));
});

test('headlines break into balanced lines, never a lone last word',()=>{
  assert.deepEqual(balanceHeadline('Kandiliniz mübarek olsun'),['Kandiliniz','mübarek olsun']);
  assert.deepEqual(balanceHeadline('Üç Aylar başlıyor'),['Üç Aylar','başlıyor']);
  assert.deepEqual(balanceHeadline('Hicri yeni yılınız mübarek olsun'),
    ['Hicri yeni yılınız','mübarek olsun']);
  assert.deepEqual(balanceHeadline('Kadir Geceniz mübarek olsun'),['Kadir Geceniz','mübarek olsun']);
  assert.deepEqual(balanceHeadline('Hoş geldin Ramazan'),['Hoş geldin','Ramazan']);
  for(const day of RELIGIOUS_DAYS){
    const lines=balanceHeadline(religiousDayShareCopy(day).headline);
    assert.ok(lines.length>=1&&lines.length<=3);
    assert.ok(lines.every(l=>l.length<=19),lines.join(' / '));
  }
});

test('Turkish capitals keep dotted and dotless i apart',()=>{
  assert.equal(turkishUpper('Regaip Kandili'),'REGAİP KANDİLİ');
  assert.equal(turkishUpper('Üç Ayların Başlangıcı'),'ÜÇ AYLARIN BAŞLANGICI');
  assert.equal(turkishUpper('Aşure Günü'),'AŞURE GÜNÜ');
});

test('headline fit picks the fewest lines that stay large',()=>{
  const story={width:216,height:128,maxFont:37,minFont:26};
  const post={width:216,height:88,maxFont:31,minFont:23};
  assert.deepEqual(fitHeadline('Kandiliniz mübarek olsun',story).lines,['Kandiliniz','mübarek olsun']);
  const hicri=fitHeadline('Hicri yeni yılınız mübarek olsun',story);
  assert.deepEqual(hicri.lines,['Hicri','yeni yılınız','mübarek olsun']);
  assert.ok(hicri.fontSize>=26);
  assert.ok(fitHeadline('Hicri yeni yılınız mübarek olsun',post).fontSize>=23);
  assert.deepEqual(splitHeadline('Hoş geldin Ramazan',2),['Hoş geldin','Ramazan']);
  for(const day of RELIGIOUS_DAYS)for(const box of [story,post]){
    const fit=fitHeadline(religiousDayShareCopy(day).headline,box);
    assert.ok(fit.fontSize>=box.minFont&&fit.fontSize<=box.maxFont,day.id);
    assert.equal(fit.lines.join(' '),religiousDayShareCopy(day).headline);
  }
});
