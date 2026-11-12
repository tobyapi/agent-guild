// 「仮面舞踏会」: 舞台の上で、深紅のビロードの幕が肖像を縁取る。上は房付きの垂れ幕がたわみ、左の幕は金の紐で
// 絞られて裾が広がる。右上の角には羽根を挿した金と黒漆の大きな半仮面が掛かり、結び紐のリボンが炎のように右へ流れる。
import { frameDocument, openingShadow } from '../kit/frame';
import { square } from '../kit/geometry';
import { sparkle } from '../kit/motifs';
import { tube, type WPt } from '../kit/organic';
import { blur, grain, linear, radial, radialAt } from '../kit/paint';
import { mask, MASQ_INK, PLUMES, ROD_Y, swag, tassel } from './masquerade-parts';

const DEFS =
  linear('velvet', [
    [0, '#c42446'],
    [0.45, '#6e0c22'],
    [1, '#240410'],
  ]) +
  linear('gold', [
    [0, '#fff6c8'],
    [0.3, '#ffe08a'],
    [0.6, '#d39a2e'],
    [1, '#6a4208'],
  ]) +
  linear('lacquer', [
    [0, '#5a5878'],
    [0.35, '#1c1a2a'],
    [1, '#050409'],
  ]) +
  radial(
    'bead',
    [
      [0, '#fff8d8'],
      [0.5, '#ffe08a'],
      [1, '#6a4208'],
    ],
    [0.4, 0.35, 0.65, 0.35, 0.3],
  ) +
  radial(
    'ruby',
    [
      [0, '#ffd0da'],
      [0.4, '#ff4a6a'],
      [1, '#5a0414'],
    ],
    [0.4, 0.35, 0.65, 0.35, 0.3],
  ) +
  linear('teal', [
    [0, '#9af0e4'],
    [0.5, '#2fb3a8'],
    [1, '#0c4a46'],
  ]) +
  linear('violet', [
    [0, '#d6c0ff'],
    [0.5, '#7a4ad0'],
    [1, '#2a1260'],
  ]) +
  linear(
    'velvetV',
    [
      [0, '#4a0818'],
      [0.6, '#c42446'],
      [1, '#7a0c26'],
    ],
    [0, 0, 0, 1],
  ) +
  linear(
    'drape',
    [
      [0, '#3a0614'],
      [0.25, '#c42446'],
      [0.5, '#5a0a1c'],
      [0.75, '#d43456'],
      [1, '#2a0410'],
    ],
    [0, 0, 1, 0],
  ) +
  linear(
    'stage',
    [
      [0, '#6a3a1e'],
      [1, '#1e0c04'],
    ],
    [0, 0, 0, 1],
  ) +
  radialAt(
    'footlight',
    [
      [0, '#fff2b0', 0.9],
      [0.4, '#ffc860', 0.35],
      [1, '#ffb040', 0],
    ],
    0,
    0,
    10,
  ) +
  '<clipPath id="maskRight"><rect x="0" y="-14" width="24" height="24"/></clipPath>' +
  grain('pile', '0.7', 0.35, 13) +
  blur('sheen', 2.4);

const LEFT_DRAPE = 'M5 6H23C23 26 22 46 21 64C17 67 12 68 9 67C15 78 20 94 26 106L6 108C7 96 9 80 9 67C7 56 5 30 5 6Z';
const LEFT_FOLDS =
  'M10 6C10 30 11 50 12 66M16 6C16 30 17 50 17.5 65M12 71C13 86 15 97 16 107M18 71C19.5 86 21 97 22 106.5';
const RIGHT_DRAPE = 'M123 6V105H109C108 80 110 40 107 6Z';
const RIGHT_FOLDS = 'M114 6C115 40 113 80 114 105M119 6C118.5 40 119.5 80 119 105';

const DRAPES =
  `<g filter="url(#drop)"><path d="${RIGHT_DRAPE}" fill="url(#drape)" stroke="${MASQ_INK}" stroke-width="0.8"/>` +
  `<path d="${LEFT_DRAPE}" fill="url(#drape)" stroke="${MASQ_INK}" stroke-width="0.8" filter="url(#pile)"/></g>` +
  `<path d="${LEFT_FOLDS}${RIGHT_FOLDS}" fill="none" stroke="#1e020a" stroke-width="1.4" opacity="0.5"/>` +
  `<path d="${LEFT_FOLDS}${RIGHT_FOLDS}" fill="none" stroke="#ff9ab0" stroke-width="0.6" opacity="0.4" transform="translate(-1.4 0)"/>` +
  '<g filter="url(#drop)"><ellipse cx="15" cy="67" rx="8.5" ry="2.6" fill="none" stroke="url(#gold)" stroke-width="2.4"/></g>' +
  tassel(10.5, 68, 0.95);

const STAGE =
  '<g filter="url(#drop)">' +
  `<path d="M5 104.5H123L121 114Q64 126 7 114Z" fill="url(#stage)" stroke="${MASQ_INK}" stroke-width="0.8"/>` +
  '<path d="M5 105.3H123" stroke="url(#gold)" stroke-width="2.2"/>' +
  '<path d="M8 111.6C30 118.6 98 118.6 120 111.6" fill="none" stroke="url(#gold)" stroke-width="1.2" opacity="0.8"/></g>' +
  [30, 50, 78, 98]
    .map(
      (x) =>
        `<circle cx="${x}" cy="110" r="9" fill="url(#footlight)"/>` +
        `<path d="M${x - 3.2} 111A3.2 3.2 0 0 1 ${x + 3.2} 111Z" fill="#fff4c8" stroke="#6a4208" stroke-width="0.5"/>`,
    )
    .join('');

const RIBBONS: [string, WPt[]][] = [
  [
    'url(#violet)',
    [
      [117, 30, 2],
      [121.5, 48, 3.6],
      [117.5, 64, 4.4],
      [121.5, 80, 3.6],
      [119, 92, 0],
    ],
  ],
  [
    'url(#gold)',
    [
      [114, 28, 2.4],
      [119, 40, 4.2],
      [114.5, 56, 5],
      [120, 72, 5.4],
      [114.5, 88, 5.6],
      [119.5, 99, 4.4],
      [121, 104, 0],
    ],
  ],
  [
    'url(#teal)',
    [
      [111, 30, 2.4],
      [113, 46, 4.2],
      [110, 62, 5],
      [114.5, 78, 5.4],
      [110.5, 94, 5.4],
      [113.5, 103, 0],
    ],
  ],
];

const ROD_ENDS = [7, 121]
  .map((x) => `<circle cx="${x}" cy="${ROD_Y}" r="2.2" fill="url(#bead)" stroke="#3a2404" stroke-width="0.5"/>`)
  .join('');

export function masqueradeFrame(): string {
  const body =
    `<path d="${square(18.5, 11.5)}" fill="none" stroke="#240410" stroke-width="5"/>` +
    STAGE +
    DRAPES +
    `<path d="M7 ${ROD_Y}H121" stroke="url(#gold)" stroke-width="2.4" stroke-linecap="round" filter="url(#drop)"/>` +
    swag(5, 48, 22) +
    swag(80, 123, 22) +
    swag(40, 88, 23.5, 12) +
    openingShadow(0.5) +
    `<g filter="url(#drop)">${RIBBONS.map(([fill, points]) => tube(points, { fill, ink: '#14060a', lightOpacity: 0.45 })).join('')}</g>` +
    PLUMES +
    mask(100, 21, 14, 1.08) +
    sparkle(40, 116, 3, '#fff6d0') +
    sparkle(90, 117, 2.2, '#fff6d0', 0.9) +
    ROD_ENDS;
  return frameDocument(DEFS, body);
}
