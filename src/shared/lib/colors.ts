// 個人色（Agent.color / Profile.color。データとして保存される値で、UI のテーマ色ではない）。
// 見本は docs/ui-design.md §2 の12色。アバターのタイルにだけ使い、名前の文字色にはしない。

export interface ColorPreset {
  name: string;
  value: string;
}

/** 色見本。新規作成時はここから順に割り当てる */
export const COLOR_PRESETS: readonly ColorPreset[] = [
  { name: '朱', value: '#ea856b' },
  { name: '柿', value: '#e28d4f' },
  { name: '山吹', value: '#cb9d2a' },
  { name: '萌黄', value: '#91b34d' },
  { name: '若竹', value: '#4cbd88' },
  { name: '青磁', value: '#00beb7' },
  { name: '浅葱', value: '#22b5e1' },
  { name: '群青', value: '#7ca2f6' },
  { name: '藤', value: '#b191ea' },
  { name: '菖蒲', value: '#d285cb' },
  { name: '桜', value: '#e680a1' },
  { name: '鈍', value: '#9199a5' },
];

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
