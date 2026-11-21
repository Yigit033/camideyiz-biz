import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const assets=new URL('../apps/mobile/assets/',import.meta.url);
const items=[
  ['app-icon.png','54f731ab37e8a205dcba9c5b7c602d140a8fadbfc69851533482fe9935580f29'],
  ['adaptive-icon.png','b5d7097d0fdbc10319d9f9ae96acd57553e2364e1fd27f9a74e74efc5351c8b2'],
];
for(const [name,sha] of items){
  const file=new URL(name,assets);
  assert.ok(existsSync(file),name+' missing: extract the approved icon ZIP into apps/mobile/assets/');
  const data=readFileSync(file);
  assert.equal(createHash('sha256').update(data).digest('hex'),sha,
    name+' changed or corrupted; do not replace owner-approved artwork');
  assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a','PNG required');
  assert.equal(data.readUInt32BE(16),1024,'1024px width required');
  assert.equal(data.readUInt32BE(20),1024,'1024px height required');
}
const config=readFileSync(new URL('../apps/mobile/app.config.js',import.meta.url),'utf8');
assert.match(config,/adaptiveIcon/);
assert.match(config,/\.\/assets\/app-icon\.png/);
assert.match(config,/\.\/assets\/adaptive-icon\.png/);
console.log('Owner-approved 1024px icon and adaptive foreground: exact sha256/dimensions/config OK');
