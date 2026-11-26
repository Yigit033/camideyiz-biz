import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GALLERY_CATEGORIES,GALLERY_PRESETS,GALLERY_TEXT_MAX_LENGTH,
  DEFAULT_GALLERY_DRAFT,canExportGalleryDesign,cleanGalleryText,
  galleryFormatDimensions,galleryTextRelativeTop,galleryTextFitScale,parseGalleryDraft,
  galleryPhotoFraming,
} from './shareGallery.ts';

test('Turkish ready greetings are unique, plain text and do not claim verses',()=>{
  const ids=new Set(GALLERY_PRESETS.map(x=>x.id));
  assert.equal(ids.size,GALLERY_PRESETS.length);
  assert.ok(GALLERY_PRESETS.some(x=>x.text==='Hayırlı Cumalar'));
  assert.ok(GALLERY_PRESETS.every(x=>x.text.length<=GALLERY_TEXT_MAX_LENGTH));
  assert.ok(GALLERY_PRESETS.every(x=>GALLERY_CATEGORIES.some(c=>c.id===x.category)));
});
test('untrusted user input is sanitized and capped before entering export',()=>{
  assert.equal(cleanGalleryText('Merhaba\r\nDünya\u0000'),'Merhaba\nDünya');
  assert.equal(cleanGalleryText('a'.repeat(180)).length,GALLERY_TEXT_MAX_LENGTH);
  assert.equal(canExportGalleryDesign(false,'Hayırlı Cumalar'),false);
  assert.equal(canExportGalleryDesign(true,'  '),false);
  assert.equal(canExportGalleryDesign(true,'Hayırlı Cumalar'),true);
});
test('story and feed export dimensions preserve their aspect ratios',()=>{
  assert.deepEqual(galleryFormatDimensions('story'),{width:1080,height:1920});
  assert.deepEqual(galleryFormatDimensions('post'),{width:1080,height:1350});
  assert.ok(galleryTextRelativeTop('top')<galleryTextRelativeTop('center'));
  assert.ok(galleryTextRelativeTop('center')<galleryTextRelativeTop('bottom'));
});
test('invalid locally saved draft cannot override validated editor preferences',()=>{
  assert.deepEqual(parseGalleryDraft(DEFAULT_GALLERY_DRAFT),DEFAULT_GALLERY_DRAFT);
  assert.equal(parseGalleryDraft({ ...DEFAULT_GALLERY_DRAFT,font:'unknown'}),null);
  assert.equal(parseGalleryDraft({...DEFAULT_GALLERY_DRAFT,text:'x'.repeat(500)}),null);
  assert.equal(DEFAULT_GALLERY_DRAFT.photoFit,'contain');
  assert.equal(parseGalleryDraft({...DEFAULT_GALLERY_DRAFT,photoFit:'cover'})?.photoFit,'cover');
  const {photoFit:_legacyFit,...legacyDraft}=DEFAULT_GALLERY_DRAFT;
  assert.equal(parseGalleryDraft(legacyDraft)?.photoFit,'contain',
    'existing saved user messages must survive framing migration');
  assert.equal(parseGalleryDraft({...DEFAULT_GALLERY_DRAFT,photoFit:'stretch'}),null);

});

test('long greetings shrink before they can be truncated by the exported canvas',()=>{
  assert.equal(galleryTextFitScale('Hayırlı Cumalar'),1);
  assert.ok(galleryTextFitScale('A'.repeat(160))<.5);
  assert.ok(galleryTextRelativeTop('top')>=.25);
  assert.ok(galleryTextRelativeTop('bottom')<=.75);
});

test('photo framing modes have measurably different layout even for near-9:16 images',()=>{
  const full=galleryPhotoFraming('contain');
  const crop=galleryPhotoFraming('cover');
  assert.deepEqual(full,{horizontalInset:.045,verticalInset:.065,resizeMode:'contain'});
  assert.deepEqual(crop,{horizontalInset:0,verticalInset:0,resizeMode:'cover'});
  assert.ok(full.horizontalInset>crop.horizontalInset);
  assert.ok(full.verticalInset>crop.verticalInset);
  // Switching 9:16 to 4:5 must not turn "Tam Fotoğraf" into a crop.
  for(const f of ['story','post'] as const){
    const dims=galleryFormatDimensions(f);
    assert.ok(dims.width*(1-2*full.horizontalInset)<dims.width);
    assert.ok(dims.height*(1-2*full.verticalInset)<dims.height);
  }
});
