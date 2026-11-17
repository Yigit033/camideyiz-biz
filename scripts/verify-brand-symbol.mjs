import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const asset=readFileSync(new URL('../apps/mobile/assets/camideyiz-original-symbol.png',import.meta.url));
const component=readFileSync(
  new URL('../apps/mobile/src/components/CamideyizBrandLogo.tsx',import.meta.url),'utf8');
const header=readFileSync(
  new URL('../apps/mobile/src/features/prayer/HomeBrandHeader.tsx',import.meta.url),'utf8');

// Freeze the user's supplied mark: do not inadvertently replace it with a
// generated approximation, alter the blue dimensional gradient, or put the
// solid black screenshot background back into the application's home header.
const expectedSha256='99f63639d967a0a2650d8ddc07dfef5b63e85a1e7bedf83755b3382e95c2a050';
assert.equal(createHash('sha256').update(asset).digest('hex'),expectedSha256,
  'Owner-supplied brand symbol has changed: require explicit user approval');
assert.equal(asset.subarray(0,8).toString('hex'),'89504e470d0a1a0a',
  'Brand symbol must remain a PNG');
assert.equal(asset.readUInt32BE(16),220);
assert.equal(asset.readUInt32BE(20),138);
assert.equal(asset.toString('latin1',12,16),'IHDR');
assert.match(component,/BRAND_SYMBOL=require\('\.\.\/\.\.\/assets\/camideyiz-original-symbol\.png'\)/);
assert.match(component,/source=\{BRAND_SYMBOL\}/);
assert.match(header,/<CamideyizBrandLogo compact=\{compact\} horizontal\/>/);
assert.doesNotMatch(component,/SYMBOL_PATH|camideyizIconBlue/,
  'Do not redraw supplied symbol as a different vector');
console.log('Original owner-supplied symbol: exact asset hash, dimensions and header wiring OK');
