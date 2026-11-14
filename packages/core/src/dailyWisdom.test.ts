import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyWisdom,QURAN_SELECTIONS,HADITH_SELECTIONS,WISDOM_LIBRARY,wisdomById} from './dailyWisdom.ts';

test('all curated excerpt records are identifiable, sourced and bounded',()=>{
 const ids=new Set<string>();
 for(const item of WISDOM_LIBRARY){
   assert.ok(item.id.length>5&&!ids.has(item.id));
   ids.add(item.id);
   assert.ok(item.reference.length>3&&item.category.length>2);
   assert.ok(item.note.length>14);
   assert.ok(item.excerpt.length>10&&item.excerpt.length<170);
   const u=new URL(item.sourceUrl);
   assert.equal(u.protocol,'https:');
   assert.ok(u.hostname==='kuran.diyanet.gov.tr'||u.hostname==='hadislerleislam.diyanet.gov.tr');
   assert.equal(wisdomById(item.id)?.excerpt,item.excerpt);
 }
 assert.equal(WISDOM_LIBRARY.length,QURAN_SELECTIONS.length+HADITH_SELECTIONS.length);
 assert.equal(wisdomById('unknown'),null);
});
test('each day has a deterministic verse/hadith pair across app restarts',()=>{
 const x=dailyWisdom('2026-11-14');
 assert.deepEqual(x,dailyWisdom('2026-11-14'));
 assert.equal(x.verse.kind,'verse');assert.equal(x.hadith.kind,'hadith');
 assert.equal(x.dateISO,'2026-11-14');
});
test('daily rotation has no immediate repeat for either category',()=>{
 for(let i=0;i<55;i++){
   const date=new Date(Date.UTC(2026,10,1+i)).toISOString().slice(0,10);
   const next=new Date(Date.UTC(2026,10,2+i)).toISOString().slice(0,10);
   assert.notEqual(dailyWisdom(date).verse.id,dailyWisdom(next).verse.id);
   assert.notEqual(dailyWisdom(date).hadith.id,dailyWisdom(next).hadith.id);
 }
});
test('entire verse and hadith catalogs appear before their respective cycles repeat',()=>{
 const verses=new Set<string>(),hadiths=new Set<string>();
 for(let d=0;d<Math.max(QURAN_SELECTIONS.length,HADITH_SELECTIONS.length);d++){
   const date=new Date(Date.UTC(2026,10,1+d)).toISOString().slice(0,10);
   const v=dailyWisdom(date);verses.add(v.verse.id);hadiths.add(v.hadith.id);
 }
 assert.equal(verses.size,QURAN_SELECTIONS.length);
 assert.equal(hadiths.size,HADITH_SELECTIONS.length);
});
test('invalid date is never silently mapped to a different editorial selection',()=>{
 assert.throws(()=>dailyWisdom('2026-14-99'));
 assert.throws(()=>dailyWisdom('x'));
});
