// 添えたファイルを、送れる形（base64。画像はプレビューも）にする。上限を超える画像は canvas で縮める。
// ブラウザの API（FileReader・createImageBitmap・canvas）を使うので、単体テストは pendingAttachments.ts の純粋な判定で行う。
import { MAX_IMAGE_BYTES } from '@/shared/lib/limits';
import {
  fitWithin,
  isImageType,
  MAX_IMAGE_EDGE,
  mediaTypeOf,
  needsShrink,
  renameFor,
  type PendingAttachment,
} from './pendingAttachments';

type ReadAttachment = Omit<PendingAttachment, 'key'>;

function dataUrlOf(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('ファイルを読めませんでした'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('ファイルを読めませんでした'));
    reader.readAsDataURL(blob);
  });
}

function encode(canvas: HTMLCanvasElement, mediaType: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('画像を縮められませんでした'))),
      mediaType,
      quality,
    );
  });
}

async function asImage(blob: Blob, name: string, mediaType: string): Promise<ReadAttachment> {
  const preview = await dataUrlOf(blob);
  return { name, mediaType, data: preview.slice(preview.indexOf(',') + 1), preview, size: blob.size };
}

/** 縮めて描き直す。PNG は PNG のまま、それ以外と、PNG でも 5MB を超えるものは JPEG にする */
async function shrink(file: File, bitmap: ImageBitmap): Promise<ReadAttachment> {
  const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_IMAGE_EDGE);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height);
  let mediaType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  let blob = await encode(canvas, mediaType, 0.9);
  if (blob.size > MAX_IMAGE_BYTES) {
    mediaType = 'image/jpeg';
    blob = await encode(canvas, mediaType, 0.85);
  }
  return asImage(blob, renameFor(file.name, mediaType), mediaType);
}

async function readImage(file: File): Promise<ReadAttachment> {
  const bitmap = await createImageBitmap(file);
  try {
    if (needsShrink(file.size, bitmap.width, bitmap.height)) return await shrink(file, bitmap);
    return await asImage(file, file.name || renameFor('', file.type), file.type);
  } finally {
    bitmap.close();
  }
}

/** ファイルを送れる形にする。画像は縮めてプレビューも作り、ほかはそのまま。読めなければ例外 */
export async function readAttachment(file: File): Promise<ReadAttachment> {
  const mediaType = mediaTypeOf(file);
  if (isImageType(mediaType)) return readImage(file);
  const dataUrl = await dataUrlOf(file);
  return {
    name: file.name || 'file',
    mediaType,
    data: dataUrl.slice(dataUrl.indexOf(',') + 1),
    preview: null,
    size: file.size,
  };
}
