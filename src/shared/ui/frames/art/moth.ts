// 「蛾と角灯」: 鍛鉄の唐草が渦を巻きながら肖像を囲む。左の辺は2本の鉄がよじれ合い、左上の腕木から下がった
// 大きな角灯が枠を温かく照らす。右の辺からは巻きひげが飛び出し、右下の角には灯りに誘われた大きな蛾。
import { frameDocument, openingShadow } from '../kit/frame';
import { square } from '../kit/geometry';
import { sparkle } from '../kit/motifs';
import { spiral, tube, type WPt } from '../kit/organic';
import { blur, grain, linear, radial } from '../kit/paint';
import { IRON_INK, lantern, moth } from './moth-parts';

const DEFS =
  linear('iron', [
    [0, '#7d8590'],
    [0.45, '#3a4048'],
    [1, '#101318'],
  ]) +
  linear('bar', [
    [0, '#c4ccd6'],
    [0.35, '#7d8590'],
    [1, '#22272e'],
  ]) +
  radial('lanternGlow', [
    [0, '#ffc45a', 0.75],
    [0.45, '#ff9a2a', 0.3],
    [1, '#ff8a1a', 0],
  ]) +
  radial(
    'glass',
    [
      [0, '#fff4c2'],
      [0.45, '#ffb646'],
      [1, '#b4520c'],
    ],
    [0.5, 0.55, 0.6, 0.5, 0.5],
  ) +
  linear('fore', [
    [0, '#e6d2a6'],
    [0.5, '#9a7a52'],
    [1, '#3e2c1a'],
  ]) +
  linear('hind', [
    [0, '#c7a374'],
    [0.6, '#7a5a3a'],
    [1, '#2e2014'],
  ]) +
  radial(
    'body',
    [
      [0, '#c9a77a'],
      [0.6, '#6e5236'],
      [1, '#2a1c10'],
    ],
    [0.4, 0.35, 0.7, 0.35, 0.3],
  ) +
  grain('forge', '0.8', 0.45, 11) +
  blur('glow', 1.8);

const IRON = { fill: 'url(#iron)', ink: IRON_INK, light: '#dfe6ee', lightOpacity: 0.5, inkWidth: 0.9 };

const bar = (points: readonly WPt[]) => tube(points, IRON);

/** 左の辺: よじれ合う2本の鉄（位相をずらした波） */
function twisted(phase: number): WPt[] {
  return Array.from({ length: 17 }, (_, i): WPt => {
    const y = 26 + i * 5.2;
    return [16 + 3.4 * Math.sin((y / 21) * Math.PI * 2 + phase), y, 3.6];
  });
}

const TOP: WPt[] = [
  [16, 30, 5],
  [20, 19, 5],
  [34, 15.5, 4.6],
  [56, 17, 4.6],
  [78, 15.5, 4.6],
  [96, 17, 4.6],
  [110, 14, 4.4],
  ...spiral(114, 12.5, 5.4, 210, 1.3, 4),
];
const RIGHT: WPt[] = [
  [111, 14, 4.6],
  [111.5, 32, 5],
  [110, 50, 5],
  [111.5, 70, 5],
  [110, 90, 5],
  [111, 106, 5],
];
const BOTTOM: WPt[] = [
  ...spiral(12.5, 115, 5, 0, -1.5, 6.5).reverse(),
  [18, 110, 6.5],
  [40, 109.5, 6],
  [64, 110.5, 6.5],
  [88, 109.5, 6],
  [110, 110, 6.5],
  ...spiral(115.5, 115, 5, 0, 1.5, 6.5),
];
const TENDRILS: WPt[][] = [
  [[111, 40, 3.4], [116, 35.5, 3], ...spiral(117.5, 41, 5.2, 0, 1.4, 2.8)],
  [[111, 74, 3.4], [116, 79, 3], ...spiral(117.5, 73, 5.2, 180, -1.3, 2.8)],
  [[16, 84, 3], [10, 90, 2.6], ...spiral(10, 84.5, 4.6, 180, 1.2, 2.4)],
];
/** 角灯を吊る腕木（上の辺から左上へ伸び、先で巻く） */
const ARM: WPt[] = [[34, 16, 4.4], [24, 10, 4], [16, 8, 3.6], ...spiral(11.5, 13, 5, 0, -1.3, 3.2)];

const LEFT = bar(twisted(0)) + bar(twisted(Math.PI));

export function mothFrame(): string {
  const body =
    `<path d="${square(18.5, 11.5)}" fill="none" stroke="#14171c" stroke-width="5" filter="url(#forge)"/>` +
    `<g filter="url(#drop)">${LEFT}${bar(BOTTOM)}${bar(RIGHT)}${TENDRILS.map(bar).join('')}${bar(TOP)}${bar(ARM)}</g>` +
    openingShadow(0.5) +
    '<ellipse cx="14" cy="35" rx="9.5" ry="21" fill="url(#lanternGlow)"/>' +
    '<path d="M16 8V13" stroke="#20242a" stroke-width="1.2"/>' +
    lantern(16, 12.5, 1.05) +
    '<circle cx="16" cy="34" r="5" fill="#ffd27a" opacity="0.45" filter="url(#glow)"/>' +
    sparkle(8, 58, 1.8, '#ffe6a0', 0.9) +
    sparkle(28, 9, 1.4, '#ffe6a0', 0.7) +
    moth(107, 105.5, -45, 0.62);
  return frameDocument(DEFS, body);
}
