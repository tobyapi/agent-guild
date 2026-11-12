// 「仮面舞踏会」の部品（半仮面・羽根飾り・房・幕の垂れ）。塗りは masquerade.ts の defs の url(#…) を使う。
import { round } from '../kit/geometry';
import { along, tube, type WPt } from '../kit/organic';

export const MASQ_INK = '#1a0408';

/** 半仮面（左半分は金、右半分は黒漆。目の穴は抜く） */
const MASK_OUTLINE =
  'M-21 -2C-22 -9 -15 -12 -8 -10C-4 -9 -2 -6 0 -6C2 -6 4 -9 8 -10C15 -12 22 -9 21 -2C20 5 13 9 6 6C3 5 1 3 0 3' +
  'C-1 3 -3 5 -6 6C-13 9 -20 5 -21 -2Z';
const EYES = 'M-15 -3C-13 -7 -8 -7 -6 -3C-8 -0.6 -13 -0.6 -15 -3Z M15 -3C13 -7 8 -7 6 -3C8 -0.6 13 -0.6 15 -3Z';

/** 半仮面（中心・向き・大きさ）。defs に maskRight の clipPath を置く */
export function mask(x: number, y: number, angle: number, scale: number): string {
  return (
    `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})" filter="url(#drop)">` +
    `<path d="${MASK_OUTLINE} ${EYES}" fill-rule="evenodd" fill="url(#gold)" stroke="#3a2404" stroke-width="0.8"/>` +
    `<path d="${MASK_OUTLINE} ${EYES}" fill-rule="evenodd" fill="url(#lacquer)" clip-path="url(#maskRight)"/>` +
    `<path d="${EYES}" fill="none" stroke="#3a2404" stroke-width="1.1"/>` +
    '<path d="M0 -6V3" stroke="#e9c46a" stroke-width="1.2"/>' +
    '<path d="M-19 -5C-16 -9 -10 -10 -6 -8.4" fill="none" stroke="#fff8d8" stroke-width="1" opacity="0.9"/>' +
    '<path d="M8 4C11 5 15 4 18 1" fill="none" stroke="#e9c46a" stroke-width="0.7" opacity="0.8"/>' +
    '<circle cx="0" cy="-9" r="2.6" fill="url(#ruby)" stroke="#3a0410" stroke-width="0.5"/>' +
    '<circle cx="-0.7" cy="-9.8" r="0.7" fill="#fff"/></g>'
  );
}

/** 羽根（付け根から先へ。点の列は中心線、太さは羽根の幅） */
export function plume(points: readonly WPt[], fill: string): string {
  return (
    tube(points, { fill, ink: '#0c0610', light: '#fff', lightOpacity: 0.35, inkWidth: 0.7 }) +
    `<path d="${along(points, 0)}" fill="none" stroke="#f6e6ff" stroke-width="0.6" opacity="0.7"/>`
  );
}

/** 房（吊り元・大きさ） */
export function tassel(x: number, y: number, scale: number): string {
  return (
    `<g transform="translate(${x} ${y}) scale(${scale})" filter="url(#drop)">` +
    '<circle cx="0" cy="2" r="3.4" fill="url(#bead)" stroke="#3a2404" stroke-width="0.5"/>' +
    '<path d="M-3.4 5H3.4L5.8 20H-5.8Z" fill="url(#gold)" stroke="#3a2404" stroke-width="0.5"/>' +
    '<path d="M-3.6 7L-4.4 19M-1.8 7L-2.2 19.4M0 7V19.6M1.8 7L2.2 19.4M3.6 7L4.4 19" stroke="#7a4e0a" stroke-width="0.5"/>' +
    '<rect x="-3.8" y="5" width="7.6" height="2.2" rx="1" fill="url(#ruby)"/></g>'
  );
}

/** 幕を吊る棒の高さ */
export const ROD_Y = 6;

/** 上の幕の垂れ（棒の x0〜x1 に掛かり、中ほどが dip まで下がる。房の縁取りとひだ付き） */
export function swag(x0: number, x1: number, dip: number, top = 11): string {
  const mid = round((x0 + x1) / 2);
  const ctrl = round(top + (dip - top) * 2);
  const hem = `M${x1} ${top}Q${mid} ${ctrl} ${x0} ${top}`;
  const folds = [0.35, 0.65]
    .map(
      (t) =>
        `M${round(x1 - 1)} ${round(ROD_Y + (top - ROD_Y) * t)}Q${mid} ${round(ROD_Y + (top - ROD_Y) * t + (ctrl - top) * t * 1.15)} ${round(x0 + 1)} ${round(ROD_Y + (top - ROD_Y) * t)}`,
    )
    .join('');
  return (
    `<g filter="url(#drop)"><path d="M${x0} ${ROD_Y}H${x1}V${top}Q${mid} ${ctrl} ${x0} ${top}Z" fill="url(#velvetV)" stroke="${MASQ_INK}" stroke-width="0.8"/></g>` +
    `<path d="${folds}" fill="none" stroke="#2a0410" stroke-width="1.6" opacity="0.55"/>` +
    `<path d="${folds}" fill="none" stroke="#ff8aa0" stroke-width="0.6" opacity="0.5" transform="translate(0 -1.2)"/>` +
    `<path d="${hem}" fill="none" stroke="url(#gold)" stroke-width="3.4" stroke-dasharray="0.9 0.9" transform="translate(0 1.6)"/>` +
    `<path d="${hem}" fill="none" stroke="url(#gold)" stroke-width="1.3"/>`
  );
}

/** 仮面に挿した羽根飾り（上の辺に沿って左へ流れる） */
export const PLUMES =
  '<g filter="url(#drop)">' +
  plume(
    [
      [102, 14, 1.5],
      [91, 10, 5],
      [79, 8.5, 5.4],
      [68, 10, 2.8],
      [60, 13.5, 0],
    ],
    'url(#violet)',
  ) +
  plume(
    [
      [104, 13, 1.5],
      [98, 8.5, 4],
      [90, 7, 3.8],
      [83, 8, 0],
    ],
    'url(#lacquer)',
  ) +
  plume(
    [
      [108, 12, 1.4],
      [113, 7.5, 3.4],
      [118, 5.8, 2.2],
      [121, 6.8, 0],
    ],
    'url(#teal)',
  ) +
  '</g>';
