// 「時計職人の工房」の部品（輻の歯車・巻き鍵・振り子・管の継ぎ輪）。塗りは clockwork.ts の defs の url(#…) を使う。
import { polar } from '../kit/geometry';
import { circle, gear, rivet } from '../kit/motifs';

export const CLOCK_INK = '#1c1206';

/** 輻（スポーク）で抜いた歯車（中心・歯先の半径・歯の数・輻の数・材） */
export function wheel(
  cx: number,
  cy: number,
  r: number,
  teeth: number,
  spokes: number,
  fill: string,
  phase = 0,
): string {
  const windows = Array.from({ length: spokes }, (_, index) => {
    const a = phase + (360 / spokes) * index + 360 / spokes / 2;
    const [x, y] = polar(cx, cy, r * 0.52, a);
    return circle(x, y, r * 0.2);
  }).join('');
  const outline = `${gear(cx, cy, r * 0.82, r, teeth, phase)}${windows}${circle(cx, cy, r * 0.14)}`;
  return (
    `<path d="${outline}" fill-rule="evenodd" fill="${fill}" stroke="${CLOCK_INK}" stroke-width="0.9" stroke-linejoin="round"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r * 0.74}" fill="none" stroke="#000" stroke-width="0.8" opacity="0.35"/>` +
    `<path d="M${cx - r * 0.66} ${cy - r * 0.2}A${r * 0.7} ${r * 0.7} 0 0 1 ${cx - r * 0.1} ${cy - r * 0.7}" fill="none" stroke="#fff" stroke-width="${r * 0.08}" stroke-linecap="round" opacity="0.6"/>` +
    rivet(cx, cy, r * 0.13, 'url(#bolt)', CLOCK_INK)
  );
}

/** 管の継ぎ輪（位置・向き・管の太さ） */
export function collar(x: number, y: number, angle: number, width: number): string {
  const h = width + 3;
  return (
    `<g transform="translate(${x} ${y}) rotate(${angle})">` +
    `<rect x="-2.2" y="${-h / 2}" width="4.4" height="${h}" rx="1.2" fill="url(#brassV)" stroke="${CLOCK_INK}" stroke-width="0.7"/>` +
    rivet(0, -h / 2 + 2, 0.9, 'url(#bolt)', CLOCK_INK) +
    '</g>'
  );
}

/** 巻き鍵（軸の付け根・向き・大きさ。右へ伸びる） */
export function windKey(x: number, y: number, angle: number, scale: number): string {
  return (
    `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})" filter="url(#drop)">` +
    `<rect x="0" y="-1.8" width="9" height="3.6" fill="url(#brass)" stroke="${CLOCK_INK}" stroke-width="0.7"/>` +
    `<path d="M8 -3H10V3H8Z" fill="url(#brass)" stroke="${CLOCK_INK}" stroke-width="0.6"/>` +
    `<path d="M10 0C10 -9 22 -12 22 -4C22 -1 19 0 16 0C19 0 22 1 22 4C22 12 10 9 10 0Z" fill="url(#brass)" stroke="${CLOCK_INK}" stroke-width="0.8" stroke-linejoin="round"/>` +
    '<path d="M14.6 -3.8A2.2 2.2 0 1 0 14.6 -3.79M14.6 3.8A2.2 2.2 0 1 1 14.6 3.81" fill="#2a1a06"/>' +
    '<path d="M11.6 -2C12.4 -6.4 17 -8.6 19.6 -6.6" fill="none" stroke="#fff6d0" stroke-width="0.9" opacity="0.75" stroke-linecap="round"/></g>'
  );
}

/** 振り子（支点・竿の長さ・振れの角度・錘の半径） */
export function pendulum(x: number, y: number, length: number, angle: number, r: number): string {
  return (
    `<g transform="translate(${x} ${y}) rotate(${angle})" filter="url(#drop)">` +
    `<rect x="-1.2" y="0" width="2.4" height="${length}" fill="url(#brassV)" stroke="${CLOCK_INK}" stroke-width="0.5"/>` +
    `<circle cx="0" cy="${length}" r="${r}" fill="url(#bob)" stroke="${CLOCK_INK}" stroke-width="0.9"/>` +
    `<circle cx="0" cy="${length}" r="${r * 0.68}" fill="none" stroke="#5e3f12" stroke-width="0.7"/>` +
    `<ellipse cx="${-r * 0.36}" cy="${length - r * 0.4}" rx="${r * 0.28}" ry="${r * 0.18}" fill="#fff" opacity="0.8"/>` +
    rivet(0, 0, 1.8, 'url(#bolt)', CLOCK_INK) +
    '</g>'
  );
}
