// 「風見の鴉」: 時計塔のてっぺん。月を背に、曲がった風見の矢が上の辺を斜めに渡り、その上で大きな鴉が翼を
// 上げて見張っている。右の辺は風見の柱と方位の飾り、左の辺には抜け落ちた黒い羽根が舞い、足もとは緑青の瓦屋根。
import { frameDocument, openingShadow } from '../kit/frame';
import { square } from '../kit/geometry';
import { tube, type WPt } from '../kit/organic';
import { linear, radial } from '../kit/paint';
import { feather, raven, RAVEN_INK } from './raven-parts';

const DEFS =
  linear('copper', [
    [0, '#e0915a'],
    [0.45, '#9a4e26'],
    [1, '#3e1a0a'],
  ]) +
  linear('verdigris', [
    [0, '#8fe0c8'],
    [0.5, '#5fc0a4'],
    [1, '#1f6a5a'],
  ]) +
  linear('raven', [
    [0, '#4a5070'],
    [0.4, '#2a2e44'],
    [1, '#06070c'],
  ]) +
  linear('beak', [
    [0, '#9aa0aa'],
    [0.5, '#5a5e68'],
    [1, '#16181c'],
  ]) +
  linear(
    'rod',
    [
      [0, '#b8f0de'],
      [0.5, '#5fc0a4'],
      [1, '#0f3a30'],
    ],
    [0, 0, 0, 1],
  ) +
  radial('eye', [
    [0, '#fff6c8'],
    [0.5, '#ffd76a'],
    [1, '#7a4a08'],
  ]) +
  radial('moon', [
    [0, '#fffbe0'],
    [0.7, '#f0e2a8'],
    [1, '#b8a870'],
  ]) +
  '<pattern id="tiles" width="9" height="5.5" patternUnits="userSpaceOnUse">' +
  '<path d="M0 0A4.5 4.5 0 0 0 9 0M-4.5 5.5A4.5 4.5 0 0 0 4.5 5.5A4.5 4.5 0 0 0 13.5 5.5" fill="none" stroke="#0c2a22" stroke-width="0.8"/></pattern>' +
  /* 緑青（ノイズの濃いところにだけ青緑を残す） */
  '<filter id="patina" x="0" y="0" width="100%" height="100%">' +
  '<feTurbulence type="fractalNoise" baseFrequency="0.16" numOctaves="3" seed="21" result="noise"/>' +
  '<feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  4 0 0 0 -1.9" result="mask"/>' +
  '<feComposite in="SourceGraphic" in2="mask" operator="in"/></filter>';

const ROD = { fill: 'url(#rod)', ink: '#0c2a22', light: '#e0fff4', lightOpacity: 0.5, inkWidth: 0.8 };

/** 曲がった風見の矢（左下の矢じりから右上の尾羽へ） */
const BEAM: WPt[] = [
  [10, 27, 3.6],
  [40, 22.5, 3.4],
  [70, 21, 3.4],
  [96, 17.5, 3.4],
  [118, 12, 3.6],
];
const POLE: WPt[] = [
  [114, 13, 5],
  [113, 60, 5],
  [114.5, 108, 5.6],
];

const VANE =
  `<g filter="url(#drop)">${tube(POLE, ROD)}` +
  '<path d="M104 63.4H116L120 65L116 66.6H104Z" fill="url(#verdigris)" stroke="#0c2a22" stroke-width="0.7" stroke-linejoin="round"/>' +
  '<path d="M116 59L122.5 65L116 71Z" fill="url(#copper)" stroke="#0c2a22" stroke-width="0.7" stroke-linejoin="round"/>' +
  '<circle cx="114" cy="65" r="4.6" fill="url(#copper)" stroke="#0c2a22" stroke-width="0.8"/>' +
  '<circle cx="112.6" cy="63.4" r="1.4" fill="#fff" opacity="0.6"/>' +
  tube(BEAM, ROD) +
  '<path d="M4.5 28.5L18 17.5L14 26.4L19 35Z" fill="url(#verdigris)" stroke="#0c2a22" stroke-width="0.8" stroke-linejoin="round"/>' +
  '<path d="M6.8 28L16 20.4" stroke="#e0fff4" stroke-width="0.8" opacity="0.6"/>' +
  '<path d="M112 14L118.6 5H123V19.6L118.6 23.4Z" fill="url(#verdigris)" stroke="#0c2a22" stroke-width="0.8" stroke-linejoin="round"/>' +
  '<path d="M116.6 13L121 8.4M117.6 19L122.4 14.4" stroke="#0c2a22" stroke-width="0.9"/>' +
  '<circle cx="116" cy="14" r="3.2" fill="url(#copper)" stroke="#0c2a22" stroke-width="0.7"/></g>';

const ROOF_EDGE = 'M5 113Q64 101 123 113L121.5 119Q64 112.6 6.5 119Z';
const ROOF =
  `<g filter="url(#drop)"><path d="${ROOF_EDGE}" fill="url(#copper)" stroke="${RAVEN_INK}" stroke-width="0.9"/></g>` +
  `<path d="${ROOF_EDGE}" fill="url(#verdigris)" filter="url(#patina)" opacity="0.9"/>` +
  `<path d="${ROOF_EDGE}" fill="url(#tiles)"/>` +
  '<path d="M5 113Q64 101 123 113" fill="none" stroke="url(#rod)" stroke-width="3.4" stroke-linecap="round"/>' +
  '<path d="M6 112Q64 100 122 112" fill="none" stroke="#e0fff4" stroke-width="0.7" opacity="0.6"/>';

const MOON =
  '<circle cx="101" cy="16.5" r="11" fill="url(#moon)"/>' +
  '<circle cx="97" cy="13" r="2.2" fill="#d8c88a" opacity="0.6"/><circle cx="105" cy="21" r="1.6" fill="#d8c88a" opacity="0.6"/>' +
  '<circle cx="40" cy="8" r="0.9" fill="#fffbe0"/><circle cx="56" cy="5" r="0.7" fill="#fffbe0"/><circle cx="24" cy="12" r="0.8" fill="#fffbe0"/>';

const FEATHERS =
  '<g filter="url(#drop)">' +
  feather(13, 50, 10, 1.3) +
  feather(17, 80, -20, 1.15) +
  feather(12, 98, 30, 0.95) +
  feather(30, 113.5, 78, 0.8) +
  '</g>';

export function ravenFrame(): string {
  const body =
    `<path d="${square(18.5, 11.5)}" fill="none" stroke="#14202a" stroke-width="5"/>` +
    MOON +
    ROOF +
    openingShadow(0.5) +
    VANE +
    FEATHERS +
    raven(84, 22, 1.02);
  return frameDocument(DEFS, body);
}
