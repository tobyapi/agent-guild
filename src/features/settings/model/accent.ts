// アクセントの色（操作の主役・フォーカス・選択の印の色）。テーマと同じく、この端末の表示の好みなので DB ではなく localStorage に置く。
// 既定（default）は tokens.css の灯の金。ほかは <html data-accent="..."> で tokens-accent.css がアクセントの組だけ上書きする。

import { tAppearance } from '../i18n/appearance';

export const ACCENTS = ['default', 'vermilion', 'sakura', 'green', 'sky', 'violet', 'silver'] as const;
export type Accent = (typeof ACCENTS)[number];

export const ACCENT_STORAGE_KEY = 'agent-guild.accent';
export const DEFAULT_ACCENT: Accent = 'default';

/** 保存されていた値（なければ・知らない値なら既定） */
export function parseAccent(stored: string | null): Accent {
  return ACCENTS.find((value) => value === stored) ?? DEFAULT_ACCENT;
}

/** 見本の名前（いまの言語で描画のたびに引く） */
export function accentName(accent: Accent): string {
  const names: Record<Accent, string> = {
    default: tAppearance('accentDefault'),
    vermilion: tAppearance('accentVermilion'),
    sakura: tAppearance('accentSakura'),
    green: tAppearance('accentGreen'),
    sky: tAppearance('accentSky'),
    violet: tAppearance('accentViolet'),
    silver: tAppearance('accentSilver'),
  };
  return names[accent];
}
