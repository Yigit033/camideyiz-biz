import type {ImageSourcePropType} from 'react-native';
import type {GalleryCategory} from '@camideyiz/core';

export type GallerySlot={
  id:string;title:string;category:GalleryCategory;
  recommendedText:string;index:number;accent:string;
};

/**
 * 24 editorial slots, ready for the owner's 20–30 photos.
 * No generated/stock image is presented as an approved owner photo.
 *
 * Adding an approved photo requires ONLY one static Metro require below:
 *   'cuma-01': require('../../../assets/gallery/cuma-01.webp'),
 *
 * Keep images as local bundle assets to work offline and to avoid a photo CDN,
 * user image uploads, API keys, analytics of user-written text or a backend.
 */
export const APPROVED_GALLERY_IMAGES:Record<string,ImageSourcePropType>={};

const SLOT_INPUTS:readonly [string,string,GalleryCategory,string,string][]=[
  ['cuma-01','Cuma Bereketi','cuma','Hayırlı Cumalar','#AD8856'],
  ['cuma-02','Cuma Huzuru','cuma','Cumanız mübarek olsun.','#977459'],
  ['cuma-03','Cuma Tebriği','cuma','Hayırlı Cumalar','#BD9A6B'],
  ['cuma-04','Cuma Duaları','cuma','Dualarınız kabul olsun.','#8C8860'],
  ['cuma-05','Mübarek Cuma','cuma','Cumanız mübarek olsun.','#A88768'],
  ['dua-01','İyi Dilekler','dua','Rabbim dualarınızı kabul etsin.','#7B9888'],
  ['dua-02','Huzur Dileği','dua','Huzur ve bereket sizinle olsun.','#779A94'],
  ['dua-03','Gönülden Dua','dua','Dualarınız hayırlara vesile olsun.','#749B89'],
  ['dua-04','Günün Duası','dua','Güzellikler ve hayırlar sizinle olsun.','#7E9F91'],
  ['kandil-01','Kandil Gecesi','kandil','Kandiliniz mübarek olsun.','#B49A77'],
  ['kandil-02','Mübarek Gece','kandil','Bu mübarek gece hayırlara vesile olsun.','#9B8A74'],
  ['kandil-03','Kandil Tebriği','kandil','Kandiliniz mübarek olsun.','#A99578'],
  ['ramazan-01','Ramazan Huzuru','ramazan','Hayırlı Ramazanlar','#748F83'],
  ['ramazan-02','Ramazan Bereketi','ramazan','Ramazan ayınız bereketli olsun.','#A88B65'],
  ['ramazan-03','İftar Tebriği','ramazan','Hayırlı İftarlar','#A78569'],
  ['ramazan-04','Sahur Tebriği','ramazan','Hayırlı Sahurlar','#718D9C'],
  ['bayram-01','Bayram Sevinci','bayram','Bayramınız mübarek olsun.','#C1996B'],
  ['bayram-02','Bayram Tebriği','bayram','Sevdiklerinizle huzurlu bir bayram dilerim.','#B78E76'],
  ['bayram-03','Mübarek Bayram','bayram','Bayramınız mübarek olsun.','#9F987B'],
  ['gunaydin-01','Hayırlı Sabahlar','gunaydin','Hayırlı Sabahlar','#7E9E9A'],
  ['gunaydin-02','Hayırlı Akşamlar','gunaydin','Hayırlı Akşamlar','#8A789E'],
  ['gunaydin-03','Hayırlı Günler','gunaydin','Hayırlı Günler','#9E9372'],
  ['genel-01','Güzel Dilekler','genel','Huzur ve bereket sizinle olsun.','#728B85'],
  ['genel-02','Özel Mesaj','genel','Gönlünüz güzelliklerle dolsun.','#A9876F'],
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
