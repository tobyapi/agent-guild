// 入力欄に添えた送信前の画像・ファイルの決まり（docs/ui-design.md §5.6）。数と大きさの上限は Rust と同じ。
import {
  IMAGE_MEDIA_TYPES,
  MAX_ATTACHMENTS,
  MAX_FILE_BYTES,
  MAX_IMAGE_BYTES,
  MAX_TOTAL_ATTACHMENT_BYTES,
} from '@/shared/lib/limits';
import type { AttachmentInput } from '@/shared/types/domain';
import { tComposer } from '../i18n/composer';

/** 長辺がこれより大きい画像は、送る前に縮める（エージェントもこれ以上の細かさは使わない） */
export const MAX_IMAGE_EDGE = 2560;

export interface PendingAttachment {
  /** 一覧の key（送信前だけの id） */
  key: string;
  name: string;
  mediaType: string;
  /** 中身の base64（data URL の接頭辞なし） */
  data: string;
  /** 画像ならプレビューの data URL、ファイルなら null */
  preview: string | null;
  /** バイト数 */
  size: number;
}

/** 画像としてエージェントに渡す形式か（PNG・JPEG・GIF・WebP） */
export const isImageType = (mediaType: string): boolean => IMAGE_MEDIA_TYPES.includes(mediaType);

/** ファイルの種類（ブラウザが判定できなければ application/octet-stream） */
export const mediaTypeOf = (file: { type: string }): string => file.type || 'application/octet-stream';

/** いまの数に、あといくつ足せるか */
export const remainingSlots = (count: number): number => Math.max(MAX_ATTACHMENTS - count, 0);

/** 画像以外で 10MB を超えるか（画像は縮めて送るので数えない） */
export const isTooLargeFile = (file: { type: string; size: number }): boolean =>
  !isImageType(mediaTypeOf(file)) && file.size > MAX_FILE_BYTES;

/** 足すと合計の上限を超えるか */
export function exceedsTotal(current: readonly { size: number }[], adding: readonly { size: number }[]): boolean {
  const sum = (items: readonly { size: number }[]) => items.reduce((total, item) => total + item.size, 0);
  return sum(current) + sum(adding) > MAX_TOTAL_ATTACHMENT_BYTES;
}

/** 送る前に縮めるか（5MB を超える、または長辺が MAX_IMAGE_EDGE を超える画像） */
export const needsShrink = (size: number, width: number, height: number): boolean =>
  size > MAX_IMAGE_BYTES || Math.max(width, height) > MAX_IMAGE_EDGE;

/** 縦横比を保って長辺を max に収めた大きさ（拡大はしない。1px 未満にはしない） */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height, 1));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

const EXTENSIONS: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

/** 画像の形式に合わせた名前（拡張子を付け替える。名前がなければ image） */
export function renameFor(name: string, mediaType: string): string {
  const stem = name.replace(/\.[^.\\/]*$/, '').trim() || 'image';
  return `${stem}.${EXTENSIONS[mediaType] ?? 'png'}`;
}

/** 断った理由（大きすぎるファイルを先に、次に数の超過）。なければ null */
export function rejectionMessage({ tooLarge, overflow }: { tooLarge: number; overflow: number }): string | null {
  if (tooLarge > 0) return tComposer('fileTooLarge');
  if (overflow > 0) return tComposer('tooMany', { max: MAX_ATTACHMENTS });
  return null;
}

/** 大きさの表示（例: 「820 B」「12.5 KB」「3.2 MB」） */
export function sizeLabel(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/** send_message に渡す形 */
export const toAttachmentInput = ({ name, mediaType, data }: PendingAttachment): AttachmentInput => ({
  name,
  mediaType,
  data,
});
