// プリセットの探し方・一覧の見出し・入力欄の文面への入れ方（置き換え・追記）。純粋な関数。
import { normalizeName } from '@/shared/lib/names';
import type { AnyPreset, PersonaPreset, PresetGroup } from './types';

/** 組の見出し（メンション補完の「チャンネル外 — 呼ぶと参加します」と同じ「名前 — 説明」の形） */
export const PRESET_GROUP_LABELS: Record<PresetGroup, string> = {
  character: 'キャラクター — ラノベ・漫画・アニメ風',
};

/** 検索: 空白で区切った語をすべて label・text・sample のどれかに含むもの（NFKC＋大文字小文字無視） */
export function searchPresets<T extends AnyPreset>(presets: readonly T[], query: string): T[] {
  const words = normalizeName(query).split(/\s+/).filter((word) => word !== '');
  if (words.length === 0) return [...presets];
  return presets.filter((preset) => {
    const haystack = normalizeName(`${preset.label} ${preset.text} ${preset.sample ?? ''}`);
    return words.every((word) => haystack.includes(word));
  });
}

/** 一覧の index 行の前に挟む組の見出し。組が変わる行（定番以外で始まるなら先頭も）だけ返し、ほかは null */
export function groupHeadingAt(items: readonly AnyPreset[], index: number): string | null {
  const group = items[index]?.group;
  if (group === undefined) return null;
  return index === 0 || items[index - 1]?.group !== group ? PRESET_GROUP_LABELS[group] : null;
}

/** 入力欄の文面とちょうど同じプリセット（前後の空白は無視）。なければ undefined */
export function matchingPreset<T extends PersonaPreset>(presets: readonly T[], value: string): T | undefined {
  const text = value.trim();
  return text === '' ? undefined : presets.find((preset) => preset.text === text);
}

/** 追記: いまの文面の後ろに句点でつないで足す（性格を2つ組み合わせたいとき用） */
export function appendPresetText(current: string, text: string): string {
  const base = current.trim();
  if (base === '') return text;
  return /[。．.!！?？]$/.test(base) ? `${base}${text}` : `${base}。${text}`;
}

export function findPreset<T extends PersonaPreset>(presets: readonly T[], id: string): T | undefined {
  return presets.find((preset) => preset.id === id);
}
