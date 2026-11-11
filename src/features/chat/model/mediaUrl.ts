// 本文の中の画像・動画（Markdown の ![名前](URL)）を、欄の中で見せてよいかの判定。
// - https の画像・動画は、利用者が押してから読み込む（開くだけで外へ通信しない。URL に情報を載せた持ち出しを防ぐ）
// - data: の画像（PNG・JPEG・GIF・WebP）は通信しないので、そのまま見せる
// - それ以外（http・javascript: など）は欄の中では見せない

export type MediaKind = 'image' | 'video';

export interface BodyMedia {
  kind: MediaKind;
  src: string;
  /** 外から読み込む（押してから読み込む）か。data: の画像は false */
  remote: boolean;
}

const REMOTE_URL = /^https:\/\/[^/\s]/i;
const INLINE_IMAGE = /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/]+=*$/i;
const VIDEO_PATH = /\.(?:mp4|m4v|webm|ogv|mov)$/i;

function isVideoPath(url: string): boolean {
  try {
    return VIDEO_PATH.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/** 欄の中で見せられる画像・動画なら、その種類と読み込み方。見せられなければ null */
export function bodyMedia(href: string): BodyMedia | null {
  if (INLINE_IMAGE.test(href)) return { kind: 'image', src: href, remote: false };
  if (!REMOTE_URL.test(href) || /[\s\p{Cc}]/u.test(href)) return null;
  return { kind: isVideoPath(href) ? 'video' : 'image', src: href, remote: true };
}

/** 読み込み先のホスト名（どこへ通信するかを押す前に見せる） */
export function mediaHost(src: string): string {
  try {
    return new URL(src).host;
  } catch {
    return '';
  }
}

/** 添付が、欄の中で再生する動画か */
export const isVideoType = (mediaType: string): boolean => mediaType.startsWith('video/');
