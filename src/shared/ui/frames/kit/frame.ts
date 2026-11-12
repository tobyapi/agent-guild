// 枠の絵の組み立て: 共通の defs（落ち影・ぼかし・穴の形）と、穴の縁の影。
import { band, OPENING, OPENING_RADIUS, SIZE, square } from './geometry';
import { blur, DROP_SHADOW, innerShadow } from './paint';

const COMMON_DEFS =
  DROP_SHADOW + blur('soft', 1.6) + `<clipPath id="opening"><path d="${square(OPENING, OPENING_RADIUS)}"/></clipPath>`;

/** 1つの枠の SVG 文書（defs は絵ごとのグラデーション・フィルタ） */
export function frameDocument(defs: string, body: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">` +
    `<defs>${COMMON_DEFS}${defs}</defs>${body}</svg>`
  );
}

/** 枠の厚みがアバターに落とす影（穴の内側の縁を暗く） */
export function openingShadow(opacity = 0.6): string {
  return innerShadow(band(10, 14, OPENING + 3, OPENING_RADIUS - 3), 'opening', opacity);
}
