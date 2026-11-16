import type {ImageSourcePropType} from 'react-native';
import type {GalleryCategory} from '@camideyiz/core';

export type GallerySlot={
  id:string;title:string;category:GalleryCategory;
  recommendedText:string;index:number;accent:string;
};

/** Owner-provided Mosques.zip: 27 unique photos; optimized WebP + independent thumbnails.
 * All sources are static Metro imports, bundled to work offline.
 * Category does not restrict text selection; every preset remains available.
 */
export const APPROVED_GALLERY_IMAGES:Record<string,ImageSourcePropType>={
  'cuma-01':require('../../../assets/gallery/cuma-01.webp'),
  'kandil-01':require('../../../assets/gallery/kandil-01.webp'),
  'gunaydin-01':require('../../../assets/gallery/gunaydin-01.webp'),
  'cuma-02':require('../../../assets/gallery/cuma-02.webp'),
  'dua-01':require('../../../assets/gallery/dua-01.webp'),
  'kandil-02':require('../../../assets/gallery/kandil-02.webp'),
  'kandil-03':require('../../../assets/gallery/kandil-03.webp'),
  'ramazan-01':require('../../../assets/gallery/ramazan-01.webp'),
  'cuma-03':require('../../../assets/gallery/cuma-03.webp'),
  'bayram-01':require('../../../assets/gallery/bayram-01.webp'),
  'cuma-04':require('../../../assets/gallery/cuma-04.webp'),
  'cuma-05':require('../../../assets/gallery/cuma-05.webp'),
  'ramazan-02':require('../../../assets/gallery/ramazan-02.webp'),
  'bayram-02':require('../../../assets/gallery/bayram-02.webp'),
  'ramazan-03':require('../../../assets/gallery/ramazan-03.webp'),
  'dua-02':require('../../../assets/gallery/dua-02.webp'),
  'ramazan-04':require('../../../assets/gallery/ramazan-04.webp'),
  'gunaydin-02':require('../../../assets/gallery/gunaydin-02.webp'),
  'cuma-06':require('../../../assets/gallery/cuma-06.webp'),
  'dua-03':require('../../../assets/gallery/dua-03.webp'),
  'dua-04':require('../../../assets/gallery/dua-04.webp'),
  'genel-01':require('../../../assets/gallery/genel-01.webp'),
  'genel-02':require('../../../assets/gallery/genel-02.webp'),
  'bayram-03':require('../../../assets/gallery/bayram-03.webp'),
  'dua-05':require('../../../assets/gallery/dua-05.webp'),
  'gunaydin-03':require('../../../assets/gallery/gunaydin-03.webp'),
  'genel-03':require('../../../assets/gallery/genel-03.webp'),
};
export const APPROVED_GALLERY_THUMBNAILS:Record<string,ImageSourcePropType>={
  'cuma-01':require('../../../assets/gallery/cuma-01-thumb.webp'),
  'kandil-01':require('../../../assets/gallery/kandil-01-thumb.webp'),
  'gunaydin-01':require('../../../assets/gallery/gunaydin-01-thumb.webp'),
  'cuma-02':require('../../../assets/gallery/cuma-02-thumb.webp'),
  'dua-01':require('../../../assets/gallery/dua-01-thumb.webp'),
  'kandil-02':require('../../../assets/gallery/kandil-02-thumb.webp'),
  'kandil-03':require('../../../assets/gallery/kandil-03-thumb.webp'),
  'ramazan-01':require('../../../assets/gallery/ramazan-01-thumb.webp'),
  'cuma-03':require('../../../assets/gallery/cuma-03-thumb.webp'),
  'bayram-01':require('../../../assets/gallery/bayram-01-thumb.webp'),
  'cuma-04':require('../../../assets/gallery/cuma-04-thumb.webp'),
  'cuma-05':require('../../../assets/gallery/cuma-05-thumb.webp'),
  'ramazan-02':require('../../../assets/gallery/ramazan-02-thumb.webp'),
  'bayram-02':require('../../../assets/gallery/bayram-02-thumb.webp'),
  'ramazan-03':require('../../../assets/gallery/ramazan-03-thumb.webp'),
  'dua-02':require('../../../assets/gallery/dua-02-thumb.webp'),
  'ramazan-04':require('../../../assets/gallery/ramazan-04-thumb.webp'),
  'gunaydin-02':require('../../../assets/gallery/gunaydin-02-thumb.webp'),
  'cuma-06':require('../../../assets/gallery/cuma-06-thumb.webp'),
  'dua-03':require('../../../assets/gallery/dua-03-thumb.webp'),
  'dua-04':require('../../../assets/gallery/dua-04-thumb.webp'),
  'genel-01':require('../../../assets/gallery/genel-01-thumb.webp'),
  'genel-02':require('../../../assets/gallery/genel-02-thumb.webp'),
  'bayram-03':require('../../../assets/gallery/bayram-03-thumb.webp'),
  'dua-05':require('../../../assets/gallery/dua-05-thumb.webp'),
  'gunaydin-03':require('../../../assets/gallery/gunaydin-03-thumb.webp'),
  'genel-03':require('../../../assets/gallery/genel-03-thumb.webp'),
};

const SLOT_INPUTS:readonly [string,string,GalleryCategory,string,string][]=[
  ["cuma-01","Cami Huzuru","cuma","Hayırlı Cumalar","#B19878"],
  ["kandil-01","Kandil Işıkları","kandil","Kandiliniz mübarek olsun.","#A68A70"],
  ["gunaydin-01","Bahar Sabahı","gunaydin","Hayırlı Sabahlar","#9AB3B0"],
  ["cuma-02","Kubbe Bereketi","cuma","Cumanız mübarek olsun.","#A9967D"],
  ["dua-01","Gönülden Dua","dua","Rabbim dualarınızı kabul etsin.","#9C7E77"],
  ["kandil-02","Gecenin Nuru","kandil","Bu mübarek gecenin hayırlara vesile olmasını dilerim.","#A2A5A1"],
  ["kandil-03","Hat Sanatı","kandil","Kandiliniz mübarek olsun.","#A48763"],
  ["ramazan-01","Kur’an Işığı","ramazan","Hayırlı Ramazanlar","#AD9B7F"],
  ["cuma-03","Safların Huzuru","cuma","Hayırlı Cumalar","#C2AC88"],
  ["bayram-01","Bayram Neşesi","bayram","Bayramınız mübarek olsun.","#B09A82"],
  ["cuma-04","Cami Manzarası","cuma","Rabbim cumamızı hayırlara vesile kılsın.","#A5B2AA"],
  ["cuma-05","Mimaride Huzur","cuma","Cumanız mübarek olsun.","#B7AA93"],
  ["ramazan-02","Mescidin Huzuru","ramazan","Ramazan ayınız bereketli olsun.","#AF9773"],
  ["bayram-02","Sevdiklerinle Bayram","bayram","Sevdiklerinizle huzurlu bir bayram dilerim.","#A29E9A"],
  ["ramazan-03","Ramazan Kandili","ramazan","Hayırlı İftarlar","#B69C76"],
  ["dua-02","Sükûnet","dua","Huzur ve bereket sizinle olsun.","#919A8C"],
  ["ramazan-04","Kur’an ile Huzur","ramazan","Hayırlı Sahurlar","#A99790"],
  ["gunaydin-02","Beyaz Lale","gunaydin","Hayırlı Akşamlar","#A8AA9B"],
  ["cuma-06","Minberin Sessizliği","cuma","Dualarınız kabul, cumanız mübarek olsun.","#B4A391"],
  ["dua-03","Gül ve Dua","dua","Dualarınız hayırlara vesile olsun.","#A77B78"],
  ["dua-04","Kur’an-ı Kerim","dua","Rabbim gönlünüze huzur versin.","#A5A38F"],
  ["genel-01","Ecdadın İzleri","genel","Huzur ve bereket sizinle olsun.","#9CA58F"],
  ["genel-02","Mescid Işığı","genel","Gönlünüz güzelliklerle dolsun.","#9BA48C"],
  ["bayram-03","Cami Buluşması","bayram","Bayramınız mübarek olsun.","#B29783"],
  ["dua-05","Manevi Işık","dua","Rabbim dualarınızı hayra çıkarsın.","#A19A84"],
  ["gunaydin-03","Huzurlu Gün","gunaydin","Hayırlı Günler","#AAA58E"],
  ["genel-03","Tarihi Mescit","genel","Güzellikler ve hayırlar sizinle olsun.","#A68E7D"],
 ];
export const GALLERY_SLOTS:readonly GallerySlot[]=SLOT_INPUTS.map((row,index)=>({
  id:row[0],title:row[1],category:row[2],recommendedText:row[3],
  accent:row[4],index:index+1,
}));
export const GALLERY_SLOT_COUNT=GALLERY_SLOTS.length;
export const READY_GALLERY_COUNT=GALLERY_SLOTS.filter(slot=>Boolean(
  APPROVED_GALLERY_IMAGES[slot.id],
)).length;
export function gallerySlot(id:string):GallerySlot|null{
  return GALLERY_SLOTS.find(slot=>slot.id===id)??null;
}
export function galleryPhoto(id:string):ImageSourcePropType|null{
  return APPROVED_GALLERY_IMAGES[id]??null;
}
export function galleryThumbnail(id:string):ImageSourcePropType|null{
  return APPROVED_GALLERY_THUMBNAILS[id]??galleryPhoto(id);
}
