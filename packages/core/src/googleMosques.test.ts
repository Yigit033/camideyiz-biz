import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseGoogleMosques,googleWalkingDirectionsURL,googleSearchRadius,validGooglePlaceId,
  googleMapsPlaceURL,
} from './googleMosques.ts';
const center={latitude:41.0082,longitude:28.9784};
const mosque={id:'ChIJfoo-bar-123',displayName:{text:'Süleymaniye Camii',languageCode:'tr'},
 location:{latitude:41.016,longitude:28.962},formattedAddress:'Fatih İstanbul',
 primaryType:'mosque',types:['mosque','point_of_interest']};
test('Google Nearby Search converts 20 or fewer valid results to safe model',()=>{
 const items=parseGoogleMosques({places:[mosque,{...mosque}]},center);
 assert.equal(items.length,1);
 assert.equal(items[0].name,'Süleymaniye Camii');
 assert.ok(items[0].distanceMeters>0);
 assert.equal(items[0].address,'Fatih İstanbul');
});
test('Places parser rejects unrelated types, invalid geometries and oversized payloads',()=>{
 assert.equal(parseGoogleMosques({places:[{...mosque,types:['store'],primaryType:'store'}]},center).length,0);
 assert.equal(parseGoogleMosques({places:[{...mosque,location:{latitude:200,longitude:28}}]},center).length,0);
 assert.throws(()=>parseGoogleMosques({places:Array(21).fill(mosque)},center));
 assert.throws(()=>parseGoogleMosques({elements:[]},center));
});
test('Place ID and URLs are validated before use',()=>{
 assert.equal(validGooglePlaceId('ChIJfoo-bar-123'),true);
 assert.equal(validGooglePlaceId('../../evil'),false);
 assert.match(googleMapsPlaceURL(mosque.id),/query_place_id=/);
 assert.match(googleWalkingDirectionsURL({...center,id:mosque.id}),/travelmode=walking/);
 assert.throws(()=>googleMapsPlaceURL(''));
});
test('search radius follows map zoom and is bounded',()=>{
 assert.equal(googleSearchRadius(.001),700);
 assert.equal(googleSearchRadius(2),10000);
 assert.throws(()=>googleSearchRadius(NaN));
});
