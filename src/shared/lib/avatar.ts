// アバターは「絵文字などの短い文字」か「data:image/... の画像」のどちらか（domain.ts の Agent.avatar）。
import { textLength } from './validation';
import { t } from './i18n';

const IMAGE_AVATAR = /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i;

/** 絵文字のアバターの長さの上限（ZWJ でつないだ絵文字も入るように少し広め） */
export const EMOJI_AVATAR_MAX = 16;

/** 表示してよい画像アバターか（ラスター画像の data URL だけを許す） */
export function isImageAvatar(avatar: string): boolean {
  return IMAGE_AVATAR.test(avatar);
}

/** アバターの問題（なければ null） */
export function checkAvatar(avatar: string): string | null {
  if (isImageAvatar(avatar)) return null;
  return textLength(avatar.trim()) > EMOJI_AVATAR_MAX ? t('avatarTooLong') : null;
}

/** アバターが空のときに代わりに出す1文字 */
export function avatarFallback(name: string): string {
  return Array.from(name.trim())[0] ?? '?';
}
