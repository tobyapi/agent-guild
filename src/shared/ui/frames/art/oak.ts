// 「樫の額縁」: 森のいちばん古い樫が、自分の枝で肖像を抱えている。左の太い幹は根もとで大きく張り出し、
// 右の枝は上で幹と交差して、右上に葉の茂みとどんぐりを垂らす。枝の太さはそろわず、こぶと折れ枝がある。
import { frameDocument, openingShadow } from '../kit/frame';
import { square } from '../kit/geometry';
import { along, tube, type WPt } from '../kit/organic';
import { grain, linear, radial } from '../kit/paint';
import { acorn, knot, leaf, OAK_INK, stump } from './oak-parts';

const DEFS =
  linear('bark', [
    [0, '#b08058'],
    [0.45, '#6e4528'],
    [1, '#2e180a'],
  ]) +
  linear('root', [
    [0, '#8a5e3a'],
    [0.5, '#5a3820'],
    [1, '#24120a'],
  ]) +
  linear('leaf', [
    [0, '#b8c058'],
    [0.55, '#5e7a26'],
    [1, '#22340c'],
  ]) +
  linear('autumn', [
    [0, '#f0b048'],
    [0.55, '#b0601c'],
    [1, '#4a2208'],
  ]) +
  radial(
    'nut',
    [
      [0, '#e6b06a'],
      [0.6, '#a0622c'],
      [1, '#5c3112'],
    ],
    [0.4, 0.35, 0.65, 0.35, 0.3],
  ) +
  linear('cap', [
    [0, '#8a6038'],
    [1, '#3e2410'],
  ]) +
  grain('rough', '0.9 0.25', 0.45, 9);

const BARK = { fill: 'url(#bark)', ink: OAK_INK, light: '#f2c890', lightOpacity: 0.4, inkWidth: 1 };

/** 根もと（下の辺）。左右へはみ出して、絵の足もとを広げる */
const ROOT: WPt[] = [
  [8.5, 112, 5.5],
  [13, 114.5, 11],
  [28, 112.5, 13],
  [48, 112, 10],
  [66, 110.5, 9],
  [84, 111, 9.5],
  [100, 110, 10],
  [112, 113.5, 11],
  [121, 110, 6],
];
/** 左の太い幹（左下から立ち上がり、上の辺を細くなりながら右へ） */
const TRUNK: WPt[] = [
  [14, 113, 13],
  [14, 104, 13],
  [17, 94, 12],
  [15, 80, 11],
  [17.5, 62, 10],
  [16, 44, 9.5],
  [17.5, 30, 8.5],
  [24, 19.5, 7.5],
  [38, 18.5, 6.5],
  [54, 19.5, 6],
  [70, 18.5, 5.5],
  [86, 19.5, 5],
  [99, 16, 4],
  [107, 11, 2.5],
  [112, 7, 0],
];
/** 右の枝（右下の根から上がり、上で幹の前を横切って左上へ抜ける） */
const BRANCH: WPt[] = [
  [114, 113, 12],
  [113, 104, 12],
  [111.5, 94, 10],
  [110, 76, 9],
  [111, 58, 8.5],
  [109.5, 40, 8],
  [108, 26, 7.5],
  [98, 15, 6],
  [82, 11, 5],
  [66, 10, 4],
  [54, 8, 2.6],
  [46, 5, 0],
];
const TWIGS: WPt[][] = [
  [
    [20, 24, 4.5],
    [13, 14, 3.4],
    [8.5, 9, 2.2],
    [6, 6, 0],
  ],
  [
    [13, 108, 6],
    [8, 101, 4],
    [7, 94, 0],
  ],
  [
    [30, 116, 3.6],
    [26, 119.5, 2],
    [22, 121, 0],
  ],
  [
    [76, 113.5, 3.4],
    [82, 118.5, 2],
    [89, 120.5, 0],
  ],
];
const STUB: WPt[] = [
  [15, 71, 6.6],
  [7, 66, 6],
];

function limb(points: readonly WPt[], fill = 'url(#bark)'): string {
  const lines = [-0.22, 0.08, 0.3].map((side) => along(points, side)).join('');
  return (
    `<g filter="url(#drop)">${tube(points, { ...BARK, fill })}</g>` +
    `<path d="${lines}" fill="none" stroke="#1e0e04" stroke-width="0.6" opacity="0.55" stroke-dasharray="9 3 5 4"/>`
  );
}

const CROWN =
  '<g filter="url(#drop)">' +
  leaf(98, 17, -84, 1.15) +
  leaf(111, 26, 168, 1.1) +
  leaf(106, 21, 44, 0.85) +
  leaf(100, 19, -40, 0.7, 'url(#autumn)') +
  `<path d="M110 28Q117 34 117 42M108 30Q110 40 109 46" fill="none" stroke="#4a2c14" stroke-width="1.3" stroke-linecap="round"/>` +
  acorn(117, 41, -6, 1.3) +
  acorn(109, 45, 10, 1.15) +
  '</g>';

const LITTER = '<g filter="url(#drop)">' + leaf(23, 115, -38, 0.8, 'url(#autumn)') + '</g>';

export function oakFrame(): string {
  const body =
    `<path d="${square(18.5, 11.5)}" fill="none" stroke="#1c0e06" stroke-width="5"/>` +
    limb(ROOT, 'url(#root)') +
    TWIGS.slice(1)
      .map((twig) => limb(twig))
      .join('') +
    limb(TRUNK) +
    limb(STUB) +
    stump(7, 66, 2.4, 3.3, 22) +
    knot(15.5, 86, 2.2, 3.6, 8) +
    limb(BRANCH) +
    limb(TWIGS[0] ?? []) +
    knot(111, 66, 1.8, 3, -6) +
    openingShadow(0.5) +
    LITTER +
    CROWN;
  return frameDocument(DEFS, body);
}
