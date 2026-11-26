import type {ComponentRef,RefObject} from 'react';
import type {View} from 'react-native';
import {captureRef} from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library/legacy';
import {galleryFormatDimensions,type GalleryFormat} from '@camideyiz/core';

/**
 * The one PNG export pipeline for every shareable design (Gallery photos and
 * religious-day cards): native view capture at the Gallery's 1080 px formats,
 * the system share sheet, or a write-only save to the phone's gallery.
 */
export async function captureDesignPng(view:RefObject<ComponentRef<typeof View>|null>,
  format:GalleryFormat):Promise<string>{
  if(!view.current)throw new Error('Görsel henüz hazır değil.');
  // Give Android one frame to draw image layers after a scroll or a change.
  await new Promise<void>(resolve=>setTimeout(resolve,100));
  const dims=galleryFormatDimensions(format);
  const uri=await captureRef(view,{
    result:'tmpfile',format:'png',quality:1,
    width:dims.width,height:dims.height,
  });
  if(!uri)throw new Error('Görsel dosyası üretilemedi.');
  return uri.startsWith('file://')?uri:'file://'+uri;
}

/** Checks the system share sheet first, then exports and opens it. */
export async function shareDesignPng(createUri:()=>Promise<string>):Promise<void>{
  const available=await Sharing.isAvailableAsync();
  if(!available)throw new Error('Bu cihazda sistem paylaşım menüsü kullanılamıyor.');
  const uri=await createUri();
  await Sharing.shareAsync(uri,{
    mimeType:'image/png',UTI:'public.png',
    dialogTitle:'WhatsApp veya uygun bir uygulamada paylaş',
  });
  // Returning from the system sheet does NOT prove the user sent a message.
}

/** Asks for write-only photo access, then exports and saves the design. */
export async function saveDesignPng(createUri:()=>Promise<string>):Promise<void>{
  const permission=await MediaLibrary.requestPermissionsAsync(true,['photo']);
  if(!permission.granted)throw new Error('Fotoğraf kaydetme izni verilmedi.');
  await MediaLibrary.saveToLibraryAsync(await createUri());
}
