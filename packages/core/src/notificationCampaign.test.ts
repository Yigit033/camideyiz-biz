import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidBroadcast,ANNOUNCEMENT_MAX_TITLE,ANNOUNCEMENT_MAX_BODY,
} from './notificationCampaign.ts';
const now=Date.parse('2026-11-15T10:00:00Z');
test('owner schedules explicit Istanbul (+03:00) timezone, not server timezone',()=>{
  const r=isValidBroadcast('  Hayırlı Cumalar  ','  Bugün güzel bir gün olsun ',
    '2026-11-20T18:00:00+03:00',now);
  assert.equal(r?.scheduledAt,'2026-11-20T15:00:00.000Z');
  assert.equal(r?.title,'Hayırlı Cumalar');
  assert.equal(r?.body,'Bugün güzel bir gün olsun');
});
test('cannot schedule a broadcast without timezone, in past or too close',()=>{
  assert.equal(isValidBroadcast('Duyuru','Merhaba Dünya','2026-11-20T18:00:00',now),null);
  assert.equal(isValidBroadcast('Duyuru','Merhaba Dünya','2026-11-15T10:00:00Z',now),null);
  assert.equal(isValidBroadcast('Duyuru','Merhaba Dünya','2026-11-15T10:04:59Z',now),null);
  assert.equal(isValidBroadcast('Duyuru','Merhaba Dünya','2027-02-20T10:00:00Z',now),null);
});
test('rejects oversized/control-character announcement content',()=>{
  const when='2026-11-20T17:00:00+03:00';
  assert.equal(isValidBroadcast('A'.repeat(ANNOUNCEMENT_MAX_TITLE+1),'Normal açıklama',when,now),null);
  assert.equal(isValidBroadcast('Kısa duyuru','B'.repeat(ANNOUNCEMENT_MAX_BODY+1),when,now),null);
  assert.equal(isValidBroadcast('Kısa duyuru','Güzel gün\u0000',when,now),null);
  assert.ok(isValidBroadcast('Kısa duyuru','Güzel gün',when,now));
});
