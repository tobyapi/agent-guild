// 入力欄のスタンプ付き定型文（純粋な関数と内蔵の一覧）。文言は i18n/composer の sticker* キー。

/** 内蔵の定型文。絵柄は絵文字だけで、外部の画像素材は使わない */
export const STICKERS = [
  { id: 'continue', emoji: '▶️', key: 'stickerContinue' },
  { id: 'plan', emoji: '🧭', key: 'stickerPlanFirst' },
  { id: 'test', emoji: '🧪', key: 'stickerRunTests' },
  { id: 'summary', emoji: '📝', key: 'stickerSummarize' },
  { id: 'evidence', emoji: '🔍', key: 'stickerShowEvidence' },
  { id: 'ideas', emoji: '💡', key: 'stickerMoreIdeas' },
  { id: 'proceed', emoji: '✅', key: 'stickerProceed' },
  { id: 'pause', emoji: '⏸️', key: 'stickerPauseReport' },
] as const;

export type Sticker = (typeof STICKERS)[number];
export type StickerKey = Sticker['key'];

/**
 * 選択範囲（何も選んでいなければキャレットの位置）を snippet に置き換える。
 * 範囲は文字列の長さに収め、start と end が逆でも扱う。戻り値の caret は差し込んだ文の直後
 */
export function insertAtSelection(
  text: string,
  start: number,
  end: number,
  snippet: string,
): { text: string; caret: number } {
  const clamp = (value: number) => Math.min(Math.max(0, Number.isFinite(value) ? value : text.length), text.length);
  const from = Math.min(clamp(start), clamp(end));
  const to = Math.max(clamp(start), clamp(end));
  return { text: text.slice(0, from) + snippet + text.slice(to), caret: from + snippet.length };
}
