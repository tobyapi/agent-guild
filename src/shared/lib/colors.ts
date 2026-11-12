// 個人色（Agent.color / Profile.color。データとして保存される値で、UI のテーマ色ではない）。
// 見本は docs/ui-design.md §2 の12色。アバターのタイルにだけ使い、名前の文字色にはしない。
import { t } from './i18n';

export type ColorKey =
  | 'shu'
  | 'kaki'
  | 'yamabuki'
  | 'moegi'
  | 'wakatake'
  | 'seiji'
  | 'asagi'
  | 'gunjo'
  | 'fuji'
  | 'ayame'
  | 'sakura'
  | 'nibi';

export interface ColorPreset {
  /** 色の名前を引くキー（名前は colorName でいまの言語にする） */
  key: ColorKey;
  value: string;
}

/** 色見本。新規作成時はここから順に割り当てる */
export const COLOR_PRESETS: readonly ColorPreset[] = [
  { key: 'shu', value: '#ea856b' },
  { key: 'kaki', value: '#e28d4f' },
  { key: 'yamabuki', value: '#cb9d2a' },
  { key: 'moegi', value: '#91b34d' },
  { key: 'wakatake', value: '#4cbd88' },
  { key: 'seiji', value: '#00beb7' },
  { key: 'asagi', value: '#22b5e1' },
  { key: 'gunjo', value: '#7ca2f6' },
  { key: 'fuji', value: '#b191ea' },
  { key: 'ayame', value: '#d285cb' },
  { key: 'sakura', value: '#e680a1' },
  { key: 'nibi', value: '#9199a5' },
];

/** 色見本の名前（いまの言語） */
export function colorName(key: ColorKey): string {
  return t(`color_${key}`);
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const FALLBACK = '#9199a5';

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

/** index 番目の見本の色（見本の数で循環する） */
export function presetColor(index: number): string {
  const size = COLOR_PRESETS.length;
  return COLOR_PRESETS[((index % size) + size) % size]?.value ?? FALLBACK;
}
