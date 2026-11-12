// 「星詠みの天球儀」: 目盛りを刻んだ金の大きな円環が肖像の後ろを回り、傾いた軌道の輪が四隅を斜めに掠めて
// 小さな惑星を運ぶ。右上には大きな三日月、左下には天球儀の台に据えた水晶玉が星雲を宿して光る。
import { frameDocument, openingShadow } from '../kit/frame';
import { round, square } from '../kit/geometry';
import { sparkle } from '../kit/motifs';
import { blur, linear, radial } from '../kit/paint';

const DEFS =
  linear('enamel', [
    [0, '#3a4fa8'],
    [0.45, '#18205a'],
    [1, '#070a22'],
  ]) +
  linear('gold', [
    [0, '#fff8d6'],
    [0.3, '#ffe39a'],
    [0.6, '#d6a23e'],
    [1, '#5e3c08'],
  ]) +
  radial(
    'orb',
    [
      [0, '#e6dcff'],
      [0.35, '#a88cff'],
      [0.7, '#7a56e6'],
      [1, '#140c46'],
    ],
    [0.42, 0.4, 0.62, 0.36, 0.32],
  ) +
  radial(
    'planet',
    [
      [0, '#c8fff4'],
      [0.5, '#2fb3c8'],
      [1, '#0a3050'],
    ],
    [0.4, 0.35, 0.65, 0.35, 0.3],
  ) +
  radial('aura', [
    [0, '#b69cff', 0.65],
    [0.5, '#7a56e6', 0.25],
    [1, '#7a56e6', 0],
  ]) +
  radial(
    'bead',
    [
      [0, '#fff8d8'],
      [0.5, '#ffe39a'],
      [1, '#5e3c08'],
    ],
    [0.4, 0.35, 0.65, 0.35, 0.3],
  ) +
  `<clipPath id="outside"><path clip-rule="evenodd" d="M-8 -8H136V136H-8Z ${square(21.5, 8.5)}"/></clipPath>` +
  blur('nebula', 1.6);

const ORB =
  '<circle cx="19" cy="101" r="13.5" fill="url(#aura)"/>' +
  '<g filter="url(#drop)" transform="translate(19 102) scale(0.72) translate(-22 -100)">' +
  '<path d="M8 126H36L32 118H12Z" fill="url(#gold)" stroke="#2a1a04" stroke-width="0.7" stroke-linejoin="round"/>' +
  '<path d="M14 118H30L27 113H17Z" fill="url(#gold)" stroke="#2a1a04" stroke-width="0.6" stroke-linejoin="round"/>' +
  '<ellipse cx="22" cy="104" rx="19" ry="6" transform="rotate(-18 22 104)" fill="none" stroke="#2a1a04" stroke-width="3.2"/>' +
  '<ellipse cx="22" cy="104" rx="19" ry="6" transform="rotate(-18 22 104)" fill="none" stroke="url(#gold)" stroke-width="2"/>' +
  '<circle cx="22" cy="100" r="14" fill="url(#orb)" stroke="#1a0e46" stroke-width="0.8"/>' +
  '<g filter="url(#nebula)" opacity="0.8"><path d="M12 104C16 96 26 98 30 92" fill="none" stroke="#ffd6f6" stroke-width="2.4"/>' +
  '<path d="M14 108C20 104 28 106 33 101" fill="none" stroke="#8ae8ff" stroke-width="1.6"/></g>' +
  '<circle cx="18" cy="96" r="0.7" fill="#fff"/><circle cx="27" cy="103" r="0.5" fill="#fff"/><circle cx="21" cy="107" r="0.6" fill="#fff"/>' +
  '<path d="M12.4 94.6A11 11 0 0 1 21 88.6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.85"/>' +
  '<path d="M31 106A11 11 0 0 1 25 111.4" fill="none" stroke="#c9b8ff" stroke-width="1" stroke-linecap="round" opacity="0.7"/>' +
  /* 台の輪の手前側（玉の前を通る） */
  '<path d="M3.4 107.6A19 6 -18 0 0 40.4 99.6" fill="none" stroke="#2a1a04" stroke-width="3.2"/>' +
  '<path d="M3.4 107.6A19 6 -18 0 0 40.4 99.6" fill="none" stroke="#e9b850" stroke-width="2"/>' +
  '<circle cx="3.6" cy="107.4" r="1.8" fill="url(#bead)"/><circle cx="40.4" cy="99.6" r="1.8" fill="url(#bead)"/>' +
  '</g>';

/** 楕円（中心・半径・傾き）の上の、角度 t（度）の点 */
function onEllipse(rx: number, ry: number, tilt: number, t: number): [number, number] {
  const a = (t * Math.PI) / 180;
  const r = (tilt * Math.PI) / 180;
  const [x, y] = [rx * Math.cos(a), ry * Math.sin(a)];
  return [round(64 + x * Math.cos(r) - y * Math.sin(r)), round(64 + x * Math.sin(r) + y * Math.cos(r))];
}

function orbit(rx: number, ry: number, tilt: number, width: number, color: string): string {
  const e = `cx="64" cy="64" rx="${rx}" ry="${ry}" transform="rotate(${tilt} 64 64)" fill="none"`;
  return `<ellipse ${e} stroke="#1a1004" stroke-width="${width + 1.4}"/><ellipse ${e} stroke="${color}" stroke-width="${width}"/>`;
}

function planet(rx: number, ry: number, tilt: number, t: number, r: number, fill: string): string {
  const [x, y] = onEllipse(rx, ry, tilt, t);
  return (
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="#06182a" stroke-width="0.7"/>` +
    `<circle cx="${round(x - r * 0.35)}" cy="${round(y - r * 0.35)}" r="${round(r * 0.3)}" fill="#fff" opacity="0.7"/>`
  );
}

/** 肖像の後ろを回る金の円環と、傾いた軌道（穴の外にだけ見える） */
const RINGS =
  '<g clip-path="url(#outside)"><g filter="url(#drop)">' +
  '<circle cx="64" cy="64" r="55" fill="none" stroke="#1a1004" stroke-width="7"/>' +
  '<circle cx="64" cy="64" r="55" fill="none" stroke="url(#gold)" stroke-width="5.2"/>' +
  '<circle cx="64" cy="64" r="55" fill="none" stroke="#2a1a04" stroke-width="2.8" stroke-dasharray="0.7 2.4" opacity="0.8"/>' +
  orbit(68, 26, -40, 1.2, '#9ad8ff') +
  orbit(66, 20, 32, 1.8, '#f0c45e') +
  planet(66, 20, 32, 4, 4.2, 'url(#planet)') +
  planet(66, 20, 32, 183, 3.2, 'url(#bead)') +
  '</g></g>';

const MOON =
  '<g filter="url(#drop)" transform="translate(110 17.5) scale(0.8) rotate(-24)">' +
  '<path d="M0 -15A15 15 0 1 0 15 2A11.6 11.6 0 1 1 0 -15Z" fill="url(#gold)" stroke="#2a1a04" stroke-width="0.8"/>' +
  '<path d="M-3 -12.4A12 12 0 0 0 -8 6" fill="none" stroke="#fff8d6" stroke-width="1.2" stroke-linecap="round" opacity="0.8"/></g>';

const STARS =
  sparkle(64, 7.5, 3, '#fff8dc') +
  sparkle(120.5, 64, 2.4, '#fff8dc', 0.9) +
  sparkle(46, 116, 2.4, '#fff8dc', 0.9) +
  sparkle(8, 40, 2.2, '#fff8dc', 0.8) +
  sparkle(90, 9, 1.6, '#fff8dc', 0.8);

export function astrolabeFrame(): string {
  const body =
    `<path d="${square(18.5, 11.5)}" fill="none" stroke="url(#enamel)" stroke-width="5"/>` +
    `<path d="${square(20.6, 9.4)}" fill="none" stroke="url(#gold)" stroke-width="1.2"/>` +
    RINGS +
    openingShadow(0.5) +
    MOON +
    ORB +
    STARS;
  return frameDocument(DEFS, body);
}
