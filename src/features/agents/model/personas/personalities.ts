// 性格のプリセット（文面の正は docs/persona-presets.md。足すときは表と同じ変更で直し、id は一度出したら変えない）。
// 名前と文面は翻訳表（i18n/personalities。日本語が正）から、いまの言語で引く。text はそのままシステムプロンプトの「性格」に入る。
import { tPersonality } from '../../i18n/personalities';
import type { PersonaPreset, PresetGroup } from './types';

const ENTRIES = [
  { id: 'curious' },
  { id: 'careful' },
  { id: 'craftsman' },
  { id: 'logical' },
  { id: 'empathetic' },
  { id: 'blunt' },
  { id: 'cheerful' },
  { id: 'calm' },
  { id: 'efficient' },
  { id: 'mentor' },
  { id: 'ideas' },
  { id: 'perfectionist' },
  { id: 'easygoing' },
  // キャラクター（ラノベ・漫画・アニメの女性キャラクター風の類型）。話し方にも同じ id・label の対がある
  { id: 'tsundere', group: 'character' },
  { id: 'ojousama', group: 'character' },
  { id: 'kuudere', group: 'character' },
  { id: 'onee-san', group: 'character' },
  { id: 'gyaru', group: 'character' },
  { id: 'bokukko', group: 'character' },
  { id: 'kouhai', group: 'character' },
] as const satisfies ReadonlyArray<{ id: string; group?: PresetGroup }>;

export type PersonalityId = (typeof ENTRIES)[number]['id'];

/** 性格のプリセット（いまの言語の名前と文面） */
export function personalities(): PersonaPreset[] {
  return ENTRIES.map((entry) => ({
    ...entry,
    label: tPersonality(`${entry.id}.label`),
    text: tPersonality(`${entry.id}.text`),
  }));
}
