// 「真夜中のお茶会」: 傾いた大きな受け皿の上で、白磁の蔓が肖像を囲む。右上の角では茶碗がひっくり返りかけて、
// こぼれた紅茶が右の辺を流れ落ち、皿に溜まる。左上の蔓は渦を巻き、皿には匙と角砂糖。夜空の紺に金の星。
import { frameDocument, openingShadow } from '../kit/frame';
import { square } from '../kit/geometry';
import { sparkle } from '../kit/motifs';
import { ribbon, sheen, tube, type WPt } from '../kit/organic';
import { linear, radial } from '../kit/paint';
import { chinaFlower, chinaLeaf, COBALT, spoon, sugar, teacup, TEA_INK } from './teatime-parts';

const DEFS =
  linear('porcelain', [
    [0, '#ffffff'],
    [0.55, '#ebe5da'],
    [1, '#a9a196'],
  ]) +
  linear(
    'cup',
    [
      [0, '#a9a196'],
      [0.25, '#ffffff'],
      [0.55, '#ebe5da'],
      [1, '#8f877c'],
    ],
    [0, 0, 1, 0],
  ) +
  linear('gold', [
    [0, '#fff0b8'],
    [0.4, '#f2cf6e'],
    [1, '#8a6416'],
  ]) +
  linear('silver', [
    [0, '#ffffff'],
    [0.5, '#c5cad3'],
    [1, '#6c7380'],
  ]) +
  radial(
    'tea',
    [
      [0, '#e9a55a'],
      [0.6, '#c7782e'],
      [1, '#5a2a0a'],
    ],
    [0.45, 0.4, 0.6, 0.35, 0.3],
  ) +
  linear('sugarTop', [
    [0, '#ffffff'],
    [1, '#e9e4dc'],
  ]) +
  linear('stream', [
    [0, '#f0b060'],
    [0.5, '#c7782e'],
    [1, '#6a300c'],
  ]);

const VINE: WPt[] = [
  [12, 113, 6.5],
  [14.5, 96, 6],
  [11, 80, 5.5],
  [15, 64, 5.5],
  [12, 48, 5],
  [15.5, 32, 5],
  [22, 20, 4.5],
  [36, 15.5, 4.5],
  [52, 17, 4],
  [68, 14.5, 3.4],
  [80, 16, 2.6],
  [90, 12, 0],
];
const CURLS: WPt[][] = [
  [
    [19, 24, 4],
    [11, 18, 3.4],
    [7.5, 11, 2.8],
    [11.5, 5.5, 2.2],
    [17, 8, 1.6],
    [15, 12, 1],
    [12, 11, 0],
  ],
  [
    [12, 98, 3.2],
    [7, 93, 2.8],
    [6, 86, 2.2],
    [9, 82, 1.4],
    [11, 86, 0],
  ],
  [
    [40, 15, 2.6],
    [44, 8, 2],
    [50, 5, 1.4],
    [53, 8, 0],
  ],
];
/** こぼれた紅茶（茶碗の縁から、右の辺を流れて皿へ） */
const STREAM: WPt[] = [
  [121, 21, 2.6],
  [119, 32, 4.5],
  [115.5, 46, 6],
  [118, 62, 6.5],
  [114.5, 78, 7],
  [116.5, 92, 7],
  [112, 104, 7.5],
];

const PORCELAIN = { fill: 'url(#porcelain)', ink: COBALT, light: '#fff', lightOpacity: 0.9, inkWidth: 1.1 };

const SAUCER =
  '<g transform="rotate(-4 64 113)" filter="url(#drop)">' +
  `<ellipse cx="64" cy="113" rx="57.5" ry="8.6" fill="url(#porcelain)" stroke="${TEA_INK}" stroke-width="0.9"/>` +
  `<ellipse cx="64" cy="112.2" rx="51" ry="6" fill="none" stroke="${COBALT}" stroke-width="2.2" stroke-dasharray="5 2.4"/>` +
  '<ellipse cx="64" cy="113" rx="56" ry="7.6" fill="none" stroke="url(#gold)" stroke-width="1.2"/>' +
  '<path d="M13 110Q30 105.4 60 105" fill="none" stroke="#fff" stroke-width="1.4" opacity="0.9" stroke-linecap="round"/></g>';

const LEAVES =
  '<g filter="url(#drop)">' +
  chinaLeaf(12, 88, -35, 0.8) +
  chinaLeaf(13, 56, -145, 0.8) +
  chinaLeaf(14, 72, 60, 0.9) +
  chinaLeaf(30, 16, -20, 1) +
  chinaLeaf(62, 16, 30, 0.95) +
  chinaFlower(13, 40, 4.6) +
  chinaFlower(76, 13, 3.6) +
  chinaFlower(10.5, 105, 3.6) +
  '</g>';

const SPILL =
  `<g filter="url(#drop)"><path d="${ribbon(STREAM)}" fill="url(#stream)" stroke="#4a2008" stroke-width="0.8" opacity="0.95"/></g>` +
  `<path d="${sheen(STREAM, 0.28)}" fill="#ffe2b0" opacity="0.75"/>` +
  '<ellipse cx="107" cy="107.6" rx="12" ry="3.2" fill="url(#stream)" stroke="#4a2008" stroke-width="0.6" transform="rotate(-4 107 107.6)"/>' +
  '<g fill="#c7782e" stroke="#4a2008" stroke-width="0.5"><circle cx="121" cy="99" r="1.6"/><circle cx="95" cy="102" r="1.3"/>' +
  '<circle cx="122" cy="91" r="1"/></g>';

const STARS = sparkle(48, 8, 3, '#ffe08a') + sparkle(60, 9, 1.8, '#ffe08a', 0.8) + sparkle(34, 7, 1.6, '#ffe08a', 0.9);

export function teatimeFrame(): string {
  const body =
    `<path d="${square(18.5, 11.5)}" fill="none" stroke="#1c2550" stroke-width="5"/>` +
    goldLiner() +
    SAUCER +
    `<g filter="url(#drop)">${[VINE, ...CURLS].map((points) => tube(points, PORCELAIN)).join('')}</g>` +
    LEAVES +
    openingShadow(0.45) +
    spoon(62, 116, -80, 0.9) +
    sugar(83, 107.5) +
    sugar(91, 111) +
    SPILL +
    teacup(109, 19, 25, 0.8) +
    STARS;
  return frameDocument(DEFS, body);
}

function goldLiner(): string {
  return `<path d="${square(20.6, 9.4)}" fill="none" stroke="url(#gold)" stroke-width="1.2"/>`;
}
