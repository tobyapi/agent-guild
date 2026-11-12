// 「時計職人の工房」: 曲げた真鍮の管が肖像を囲み、右上の角からは大小の歯車がはじけ出している。
// 左の管は途中で外へ折れ曲がり、下には鋲を打った梁から振り子が垂れ、右の銅管には巻き鍵が刺さっている。
import { frameDocument, openingShadow } from '../kit/frame';
import { square } from '../kit/geometry';
import { rivet } from '../kit/motifs';
import { tube, type WPt } from '../kit/organic';
import { blur, grain, linear, radial } from '../kit/paint';
import { CLOCK_INK, collar, pendulum, wheel, windKey } from './clockwork-parts';

const DEFS =
  linear('brass', [
    [0, '#f6dc8e'],
    [0.45, '#c9973f'],
    [1, '#5e3f12'],
  ]) +
  linear(
    'brassV',
    [
      [0, '#5e3f12'],
      [0.35, '#f6dc8e'],
      [0.6, '#c9973f'],
      [1, '#4a3010'],
    ],
    [0, 0, 1, 0],
  ) +
  linear('copper', [
    [0, '#f4b080'],
    [0.45, '#b45a2c'],
    [1, '#4e200c'],
  ]) +
  linear('steel', [
    [0, '#eef2f6'],
    [0.4, '#a3acb6'],
    [1, '#2e353e'],
  ]) +
  linear('beam', [
    [0, '#6a7480'],
    [0.5, '#3a424c'],
    [1, '#12161a'],
  ]) +
  radial(
    'bolt',
    [
      [0, '#f6dc8e'],
      [0.7, '#c9973f'],
      [1, '#5e3f12'],
    ],
    [0.4, 0.35, 0.7, 0.35, 0.3],
  ) +
  radial(
    'bob',
    [
      [0, '#fff2b8'],
      [0.5, '#e0b04a'],
      [1, '#6e4a12'],
    ],
    [0.38, 0.34, 0.7, 0.34, 0.3],
  ) +
  grain('patina', '0.9', 0.3, 5) +
  blur('steam', 2.2);

/** 左の真鍮管（下の梁から立ち上がり、途中で外へ折れ、上の辺を右の歯車まで） */
const MAIN: WPt[] = [
  [30, 112, 9],
  [18, 110, 9],
  [15.5, 98, 9],
  [16, 84, 9],
  [11, 76, 8.5],
  [9.5, 64, 8.5],
  [11, 52, 8.5],
  [16, 44, 9],
  [16.5, 30, 9],
  [24, 17, 9],
  [40, 15.5, 9],
  [60, 16, 9],
  [80, 15.5, 9],
];
/** 外を回る細い銅管（左上で枠から離れて上へ逃げる） */
const THIN: WPt[] = [
  [6.5, 84, 4],
  [6.5, 50, 4],
  [8, 20, 4],
  [16, 8.5, 4],
  [40, 7.5, 4],
  [72, 8.5, 4],
];
/** 右の銅管（歯車の下から、外へ一度ふくらんで右下の梁へ） */
const RIGHT: WPt[] = [
  [113, 40, 7.5],
  [111.5, 56, 7.5],
  [118, 66, 7.5],
  [120, 80, 7.5],
  [112, 90, 7.5],
  [111.5, 104, 7.5],
];

const BRASS = { fill: 'url(#brass)', ink: CLOCK_INK, light: '#fff6d0', lightOpacity: 0.6 };
const COPPER = { fill: 'url(#copper)', ink: '#2a1206', light: '#ffe0c8', lightOpacity: 0.5 };

const BEAM =
  '<g filter="url(#drop)">' +
  `<path d="M10 105.5H118L121.5 111.5L118 117.5H10L6.5 111.5Z" fill="url(#beam)" stroke="${CLOCK_INK}" stroke-width="0.9" stroke-linejoin="round"/>` +
  '<path d="M11 107.4H117" stroke="#c6d0da" stroke-width="0.8" opacity="0.6"/>' +
  [16, 36, 92, 112].map((x) => rivet(x, 111.5, 1.5, 'url(#bolt)', CLOCK_INK)).join('') +
  '</g>';

const GEARS =
  '<g filter="url(#drop)">' +
  wheel(89, 13, 8.6, 10, 4, 'url(#copper)', 10) +
  wheel(115.5, 38, 8, 10, 4, 'url(#brass)', 6) +
  wheel(110, 18, 13.6, 14, 5, 'url(#steel)', 4) +
  '</g>';

const VALVE =
  '<g filter="url(#drop)"><circle cx="11" cy="64" r="5.8" fill="none" stroke="#9a2026" stroke-width="2.6"/>' +
  '<path d="M11 58.2V69.8M5.2 64H16.8" stroke="#9a2026" stroke-width="1.8"/>' +
  `<circle cx="11" cy="64" r="5.8" fill="none" stroke="${CLOCK_INK}" stroke-width="0.6" opacity="0.6"/>` +
  rivet(11, 64, 1.6, 'url(#bolt)', CLOCK_INK) +
  '</g>' +
  '<g filter="url(#steam)" fill="#fff" opacity="0.65"><circle cx="9.5" cy="91" r="2.6"/><circle cx="8" cy="97" r="2"/><circle cx="11" cy="101" r="1.6"/></g>';

export function clockworkFrame(): string {
  const body =
    `<path d="${square(18.5, 11.5)}" fill="none" stroke="#2a1d0c" stroke-width="5" filter="url(#patina)"/>` +
    `<g filter="url(#drop)">${tube(THIN, COPPER)}</g>` +
    BEAM +
    `<g filter="url(#drop)">${tube(MAIN, BRASS)}${tube(RIGHT, COPPER)}</g>` +
    collar(16, 92, 0, 9) +
    collar(16.4, 36, 0, 9) +
    collar(50, 15.8, 90, 9) +
    collar(112, 98, 0, 7.5) +
    VALVE +
    openingShadow(0.5) +
    pendulum(60, 106, 9, 30, 5.6) +
    windKey(104, 82, 0, 0.84) +
    GEARS;
  return frameDocument(DEFS, body);
}
