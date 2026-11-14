import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ISTANBUL_CENTER,buildOverpassQuery,parseOverpassMosques,filterMosques,
  distanceMeters,commonsTitle,walkingDirectionsURL,formatMosqueDistance,
} from './mosques.ts';
const origin=ISTANBUL_CENTER;
const node=(id:number,name:string,lat=41.0083,lon=28.9785,tags={})=>({
  type:'node',id,lat,lon,tags:{amenity:'place_of_worship',religion:'muslim',name,...tags},
});
test('Overpass query is bounded and values are sanitized',()=>{
  const query=buildOverpassQuery(origin,3500);
  assert.match(query,/around:3500,41\.00820,28\.97840/);
  assert.match(query,/building"="mosque/);
  assert.throws(()=>buildOverpassQuery({latitude:NaN,longitude:0}));
  assert.throws(()=>buildOverpassQuery(origin,100000));
});
test('parses actual OSM tags and normalized source identities',()=>{
  const result=parseOverpassMosques({elements:[
    node(1,'Süleymaniye Camii',41.0083,28.9785,{
      wheelchair:'limited','addr:city':'İstanbul',
      'addr:street':'Sokak','addr:housenumber':'2',
      wikimedia_commons:'File:Test_mosque.jpg',phone:'+90 212 000 00 00',
    }),
  ]},origin);
  assert.equal(result.length,1);
  assert.equal(result[0].id,'node/1');
  assert.equal(result[0].wheelchair,'limited');
  assert.equal(result[0].address,'Sokak 2, İstanbul');
  assert.equal(result[0].commonsFile,'File:Test mosque.jpg');
});
test('rejects non-mosque and invalid geometry instead of inventing entries',()=>{
  assert.deepEqual(parseOverpassMosques({elements:[
    {...node(5,'Kilise'),tags:{amenity:'place_of_worship',religion:'christian'}},
    {...node(6,'Bozuk'),lat:NaN},
  ]},origin),[]);
});
test('collapses same-name same-location duplicates and favors complete object',()=>{
  const res=parseOverpassMosques({elements:[
    node(1,'Cami',41.0083,28.9785),
    {type:'way',id:2,center:{lat:41.00831,lon:28.97851},
      tags:{building:'mosque',name:'Cami',website:'https://example.org'}},
    node(3,'Başka Cami',41.0084,28.9786),
  ]},origin);
  assert.equal(res.length,2);
  assert.ok(res.some(x=>x.id==='way/2'));
});
test('accent-insensitive Turkish search and filters respect tagged fields',()=>{
  const list=parseOverpassMosques({elements:[
    node(1,'Çınar Camii',41.0082,28.9784,{wheelchair:'yes',wikimedia_commons:'File:Name.jpg'}),
    node(2,'Şehitler Mescidi',41.02,28.99),
  ]},origin);
  assert.equal(filterMosques(list,'cinar','all',new Set()).length,1);
  assert.equal(filterMosques(list,'','photographed',new Set()).length,1);
  assert.equal(filterMosques(list,'','accessible',new Set()).length,1);
  assert.equal(filterMosques(list,'','favorites',new Set(['node/2']))[0].id,'node/2');
});
test('Commons image validation accepts only named file entries',()=>{
  assert.equal(commonsTitle('File:Süleymaniye.jpg'),'File:Süleymaniye.jpg');
  assert.equal(commonsTitle('https://commons.wikimedia.org/wiki/File:Foo_bar.jpg'),'File:Foo bar.jpg');
  assert.equal(commonsTitle('https://evil.example/picture.jpg'),null);
});
test('geographic helpers preserve valid origins and directions',()=>{
  assert.equal(Math.round(distanceMeters(origin,origin)),0);
  assert.match(walkingDirectionsURL(origin),/destination=41\.008200,28\.978400/);
  assert.equal(formatMosqueDistance(890),'890 m');
  assert.throws(()=>walkingDirectionsURL({latitude:180,longitude:0}));
});
