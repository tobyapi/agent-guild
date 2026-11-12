// アイコンの枠の ID と生成の入力の規則（Rust の guild-domain frame/mod.rs と同じ）。UI の事前検査とモックが使う。
import { textLength } from './validation';

export const BUILTIN_FRAME_PREFIX = 'builtin:';
export const CUSTOM_FRAME_PREFIX = 'custom:';
/** 生成を頼む説明の最大文字数 */
export const FRAME_DESCRIPTION_MAX = 200;
/** 枠の名前の最大文字数 */
export const FRAME_NAME_MAX = 24;

const FRAME_ID = /^(builtin|custom):[A-Za-z0-9-]{1,64}$/;

/** 空（枠なし）か、`builtin:` / `custom:` の後ろに英数字とハイフンが続く ID か */
export function isFrameIdShape(id: string): boolean {
  const trimmed = id.trim();
  return trimmed === '' || FRAME_ID.test(trimmed);
}

export function isCustomFrameId(id: string): boolean {
  return id.startsWith(CUSTOM_FRAME_PREFIX);
}

/** 説明の問題（なければ null）。空と長すぎる説明 */
export function frameDescriptionProblem(description: string): 'empty' | 'tooLong' | null {
  const trimmed = description.trim();
  if (trimmed === '') return 'empty';
  return textLength(trimmed) > FRAME_DESCRIPTION_MAX ? 'tooLong' : null;
}

/** 枠の名前（空なら説明の1行目。どちらも24文字で切る） */
export function frameName(name: string, description: string): string {
  const source = name.trim() === '' ? description.trim() : name.trim();
  return Array.from((source.split('\n')[0] ?? '').trim())
    .slice(0, FRAME_NAME_MAX)
    .join('');
}
