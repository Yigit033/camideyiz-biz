import test from 'node:test';
import assert from 'node:assert/strict';
import {googleMosqueSearchURL} from './mapsUrl.ts';

test('default opens a Google Maps category search and needs no API key',()=>{
  const url=new URL(googleMosqueSearchURL());
  assert.equal(url.origin,'https://www.google.com');
  assert.equal(url.pathname,'/maps/search/');
  assert.equal(url.searchParams.get('api'),'1');
  assert.equal(url.searchParams.get('query'),'yakınımdaki camiler');
  assert.equal(url.searchParams.has('key'),false);
});
test('user-selected district is safely encoded',()=>{
  const u=new URL(googleMosqueSearchURL('  İstanbul   Üsküdar  '));
  assert.equal(u.searchParams.get('query'),'camiler İstanbul Üsküdar');
  assert.ok(!u.search.includes(' '));
});
test('unexpected URL parameters stay inside encoded search text',()=>{
  const u=new URL(googleMosqueSearchURL('Ankara&key=someone'));
  assert.equal(u.searchParams.has('key'),false);
  assert.equal(u.searchParams.get('query'),'camiler Ankara&key=someone');
});
test('does not accept oversized input',()=>{
  assert.throws(()=>googleMosqueSearchURL('x'.repeat(81)),RangeError);
});
