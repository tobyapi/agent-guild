// 「港の綱」: 波止場の板の上で、太い麻の綱が肖像を巻いている。上の綱は杭のあいだでたわみ、左には漁網が
// 垂れてガラスの浮き玉を抱え、右上の角には錨が引っかかり、右下では綱が係船柱に巻きついて端がほどけている。
import { frameDocument, openingShadow } from '../kit/frame';
import { square } from '../kit/geometry';
import { loop, ribbon, sheen, smooth, type WPt } from '../kit/organic';
import { grain, linear, radial } from '../kit/paint';
import { anchor, bollard, glassFloat, HARBOR_INK, starfish } from './harbor-parts';

const DEFS =
  linear('rope', [
    [0, '#f4dea8'],
    [0.5, '#c8a062'],
    [1, '#6a4a22'],
  ]) +
  '<pattern id="twist" width="3.4" height="3.4" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">' +
  '<rect width="3.4" height="1.3" fill="#4a3014" opacity="0.55"/></pattern>' +
  '<pattern id="mesh" width="5.5" height="5.5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
  '<path d="M0 0H5.5M0 0V5.5" stroke="#1c2c2c" stroke-width="0.9"/></pattern>' +
  linear('plank', [
    [0, '#9a6a40'],
    [0.5, '#6a4426'],
    [1, '#2c180a'],
  ]) +
  linear('iron', [
    [0, '#c4ccd6'],
    [0.45, '#5a6470'],
    [1, '#161a20'],
  ]) +
  linear(
    'ironV',
    [
      [0, '#2a3038'],
      [0.3, '#8a949e'],
      [0.6, '#3a424c'],
      [1, '#0e1216'],
    ],
    [0, 0, 1, 0],
  ) +
  radial(
    'glass',
    [
      [0, '#c8f0d8'],
      [0.45, '#4aa88a'],
      [1, '#0c4a3c'],
    ],
    [0.4, 0.38, 0.7, 0.35, 0.3],
  ) +
  radial('star', [
    [0, '#ffb070'],
    [0.6, '#e0602c'],
    [1, '#7a2410'],
  ]) +
  grain('wood', '0.04 0.7', 0.5, 6);

/** 枠を巻く綱（上は杭のあいだでたわみ、左右は波打つ） */
const ROPE: WPt[] = [
  [13, 12, 8],
  [30, 16, 8.5],
  [48, 19, 9],
  [64, 19.5, 9],
  [80, 18.5, 9],
  [98, 15.5, 8.5],
  [114, 12, 8],
  [114.5, 26, 8.5],
  [111, 44, 9],
  [113, 64, 9.5],
  [110.5, 84, 9],
  [112, 100, 9],
  [106, 112.5, 9.5],
  [84, 110.5, 9],
  [64, 112.5, 9.5],
  [42, 110.5, 9],
  [22, 113, 9.5],
  [14, 102, 9],
  [16.5, 84, 9],
  [14, 64, 9.5],
  [17, 44, 9],
  [14.5, 26, 8.5],
];
/** 係船柱からほどけて垂れる綱の端 */
const TAIL: WPt[] = [
  [108, 112, 6],
  [100, 116.5, 5.5],
  [88, 117, 5],
  [78, 119, 4],
  [70, 119.5, 2.5],
];

function rope(points: readonly WPt[], closed: boolean): string {
  const d = closed ? loop(points) : ribbon(points);
  return (
    `<g filter="url(#drop)"><path d="${d}" fill-rule="evenodd" fill="url(#rope)" stroke="#3a2610" stroke-width="0.9"/></g>` +
    `<path d="${d}" fill-rule="evenodd" fill="url(#twist)"/>` +
    `<path d="${sheen(points, 0.26, closed)}" fill-rule="evenodd" fill="#fff4d0" opacity="0.5"/>`
  );
}

const PLANK =
  '<g filter="url(#drop)">' +
  `<path d="M5 104L121 99.5L124 108L121 118.5L7 120.5L3.5 113Z" fill="url(#plank)" stroke="${HARBOR_INK}" stroke-width="0.9" filter="url(#wood)"/>` +
  `<path d="M4 113.4L123 109" stroke="${HARBOR_INK}" stroke-width="0.9"/>` +
  '<path d="M6 105.2L120 100.8M5 114.8L122 110.4" stroke="#e0b07a" stroke-width="0.7" opacity="0.5"/>' +
  '<circle cx="10" cy="108.6" r="1" fill="#1a1a1a"/><circle cx="10" cy="117" r="1" fill="#1a1a1a"/></g>';

const NET_EDGE = 'M14 10C7 22 5 42 6 60C7 74 6 84 8 94Q12 90 15 96Q18 90 22 94L23 30Q22 18 14 10Z';
const NET =
  `<path d="${NET_EDGE}" fill="#20383a" opacity="0.28"/>` +
  `<path d="${NET_EDGE}" fill="url(#mesh)"/>` +
  `<path d="M14 10C7 22 5 42 6 60C7 74 6 84 8 94Q12 90 15 96Q18 90 22 94" fill="none" stroke="#c8a062" stroke-width="1.6" stroke-linecap="round"/>` +
  '<g filter="url(#drop)" stroke="#5a2a10" stroke-width="0.6">' +
  '<ellipse cx="8" cy="95" rx="2.8" ry="2.1" fill="#e8763a"/><ellipse cx="15" cy="97" rx="2.8" ry="2.1" fill="#f4e6c8"/>' +
  '<ellipse cx="22" cy="95" rx="3" ry="2.2" fill="#e8763a"/></g>' +
  glassFloat(13, 52, 8.4);

const PEGS =
  `<g filter="url(#drop)" fill="url(#plank)" stroke="${HARBOR_INK}" stroke-width="0.8">` +
  '<rect x="9" y="4" width="8" height="12" rx="2.6"/><ellipse cx="13" cy="5" rx="4" ry="2" fill="#c89a68"/></g>';

export function harborFrame(): string {
  const body =
    `<path d="${square(18.5, 11.5)}" fill="none" stroke="#2a1a0c" stroke-width="5"/>` +
    PLANK +
    rope(ROPE, true) +
    PEGS +
    bollard(113, 117.5, 0.95) +
    `<path d="${smooth([
      [104, 103],
      [113, 106.5],
      [122, 101],
    ])}" fill="none" stroke="url(#rope)" stroke-width="5.5" stroke-linecap="round"/>` +
    rope(TAIL, false) +
    openingShadow(0.5) +
    NET +
    anchor(108.4, 19.4, -135, 0.72) +
    starfish(34, 114, 6, 2.8, 14);
  return frameDocument(DEFS, body);
}
