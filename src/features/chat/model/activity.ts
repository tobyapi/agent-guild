// 動作中表示の文言（docs/ui-design.md §5.5）。
// 「考え中…」→「ハル が考え中…」、「Web検索: 〜」→「ハル が Web検索中: 〜」、「〜しています: 〜」はそのまま。

import { currentLanguage } from '@/shared/i18n';
import { tComposer } from '../i18n/composer';

const LABELLED = /^([^:：]+)[:：]\s*(.*)$/;
/** すでに動きを表している言い方（「中」「ます」で終わる）には「中」を足さない */
const ALREADY_PROGRESSIVE = /(?:中|ます|た)$/;

/** detail を「が …」の形にする（名前のあとに続ける部分）。日本語以外は区切りを置いてそのまま続ける */
export function activityPhrase(detail: string): string {
  const trimmed = detail.trim();
  if (currentLanguage() !== 'ja') return tComposer('activityDetail', { detail: trimmed });
  const match = LABELLED.exec(trimmed);
  const label = match?.[1]?.trim() ?? '';
  const phrase = match && !ALREADY_PROGRESSIVE.test(label) ? `${label}中: ${match[2] ?? ''}` : trimmed;
  return /^[A-Za-z0-9]/.test(phrase) ? `が ${phrase}` : `が${phrase}`;
}

/** 名前つきの1文（ツールチップや読み上げに使う） */
export function describeActivity(name: string, detail: string): string {
  return `${name} ${activityPhrase(detail)}`;
}

/** 3 人以上は 2 行まで出し、残りを「ほか N 人が作業中」にまとめる */
export function splitVisible<T>(items: readonly T[], max = 2): { visible: T[]; hidden: number } {
  if (items.length <= max) return { visible: [...items], hidden: 0 };
  return { visible: items.slice(0, max), hidden: items.length - max };
}
