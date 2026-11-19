// アクセントの色（操作の主役・フォーカス・選択の印の色）。テーマと同じく、この端末の表示の好みなので DB ではなく localStorage に置く。
// 既定（default）は tokens.css の灯の金。ほかは <html data-accent="..."> で tokens-accent.css がアクセントの組だけ上書きする。

import { ACCENT_IDS } from '@/shared/theme/types';
import { tAppearance } from '../i18n/appearance';

// default はテーマ既定色を使う UI/旧保存形式の値。新保存形式では null に対応する。
export const ACCENTS = ['default', ...ACCENT_IDS] as const;
export type Accent = (typeof ACCENTS)[number];

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
