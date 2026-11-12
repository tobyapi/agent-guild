// 話し方のプリセット（文面の正は docs/persona-presets.md。足すときは表と同じ変更で直し、id は一度出したら変えない）。
// 名前・文面・見本は翻訳表（i18n/tones。日本語が正）から、いまの言語で引く。
// text はそのままシステムプロンプトの「口調」に入る。sample は選ぶ前に雰囲気を見せる見本の一文（プロンプトには入れない）。
import { tTone } from '../../i18n/tones';
import type { PresetGroup, TonePreset } from './types';

const ENTRIES = [
  { id: 'polite' },
  { id: 'friendly-polite' },
  { id: 'casual' },
  { id: 'terse' },
  { id: 'business' },
  { id: 'teacher' },
  { id: 'energetic' },
  { id: 'reasoning' },
  { id: 'gentle' },
  { id: 'kansai' },
  { id: 'butler' },
  { id: 'samurai' },
  // キャラクター（ラノベ・漫画・アニメの女性キャラクター風の類型）。性格にも同じ id・label の対がある
  { id: 'tsundere', group: 'character' },
  { id: 'ojousama', group: 'character' },
  { id: 'kuudere', group: 'character' },
  { id: 'onee-san', group: 'character' },
  { id: 'gyaru', group: 'character' },
  { id: 'bokukko', group: 'character' },
  { id: 'kouhai', group: 'character' },
] as const satisfies ReadonlyArray<{ id: string; group?: PresetGroup }>;

export type ToneId = (typeof ENTRIES)[number]['id'];

/** 話し方のプリセット（いまの言語の名前・文面・見本） */
export function tones(): TonePreset[] {
  return ENTRIES.map((entry) => ({
    ...entry,
    label: tTone(`${entry.id}.label`),
    text: tTone(`${entry.id}.text`),
    sample: tTone(`${entry.id}.sample`),
  }));
}
