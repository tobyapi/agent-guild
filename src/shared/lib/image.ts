// アバター画像の読み込みと書き出し（ブラウザ専用）。切り抜く範囲の計算は crop.ts（純粋な関数）。
import type { SourceRect } from './crop';

/** アバター画像の保存サイズ（px の正方形） */
export const AVATAR_IMAGE_SIZE = 256;

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

/** ファイル選択ダイアログの accept 属性 */
export const AVATAR_IMAGE_ACCEPT = ACCEPTED_TYPES.join(',');

/** 選んだファイルの問題（なければ null） */
export function checkAvatarImageFile(file: File): string | null {
  return ACCEPTED_TYPES.includes(file.type) ? null : 'PNG・JPEG・GIF・WebP の画像を選んでください';
}

/** 画像を読む。大きな画像も createImageBitmap でデコードし、GIF は 1 コマ目になる */
export async function loadAvatarImage(file: File): Promise<ImageBitmap> {
  const problem = checkAvatarImageFile(file);
  if (problem) throw new Error(problem);
  try {
    return await createImageBitmap(file);
  } catch {
    throw new Error('画像を読み込めませんでした。別の画像を選んでください');
  }
}

/** 切り抜いて size px の正方形の data URL にする。WebP で書き出せない環境では自動的に PNG になる */
export function renderAvatarImage(bitmap: ImageBitmap, rect: SourceRect, size = AVATAR_IMAGE_SIZE): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('画像を書き出せませんでした');
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, rect.sx, rect.sy, rect.size, rect.size, 0, 0, size, size);
  return canvas.toDataURL('image/webp', 0.9);
}
