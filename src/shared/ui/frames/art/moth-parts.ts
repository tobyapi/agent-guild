// 「蛾と角灯」の部品（角灯・蛾）。塗りは moth.ts の defs の url(#…) を使う。
import { round } from '../kit/geometry';

export const IRON_INK = '#0b0d10';

/** 角灯（吊り輪が原点、下へ下がる。大きさ） */
export function lantern(x: number, y: number, scale: number): string {
  return (
    `<g transform="translate(${x} ${y}) scale(${scale})" filter="url(#drop)">` +
    `<circle cx="0" cy="1.8" r="1.8" fill="none" stroke="#20242a" stroke-width="1.1"/>` +
    `<path d="M0 3.4L9 11H-9Z" fill="url(#iron)" stroke="${IRON_INK}" stroke-width="0.8" stroke-linejoin="round"/>` +
    `<path d="M-7.4 11H7.4L8.4 30H-8.4Z" fill="url(#glass)" stroke="${IRON_INK}" stroke-width="0.8"/>` +
    '<path d="M0 17C3.4 21 3.2 25 0 27C-3.2 25 -3.4 21 0 17Z" fill="#fffbe6"/>' +
    '<path d="M-2.6 11.2L-3 29.8M2.6 11.2L3 29.8" stroke="#1a1d22" stroke-width="1.2"/>' +
    `<path d="M-10 30H10L8 34.6H-8Z" fill="url(#iron)" stroke="${IRON_INK}" stroke-width="0.8" stroke-linejoin="round"/>` +
    `<path d="M0 34.6V38.6" stroke="${IRON_INK}" stroke-width="1.6" stroke-linecap="round"/>` +
    '<path d="M-6 12.6L-6.6 28" stroke="#fff" stroke-width="0.8" opacity="0.6"/></g>'
  );
}

/** 目玉模様（翅の上） */
function eyespot(x: number, y: number, r: number): string {
  return (
    `<circle cx="${x}" cy="${y}" r="${r}" fill="#24180e"/>` +
    `<circle cx="${x}" cy="${y}" r="${round(r * 0.72)}" fill="#e2a03a"/>` +
    `<circle cx="${x}" cy="${y}" r="${round(r * 0.4)}" fill="#1a0f08"/>` +
    `<circle cx="${round(x - r * 0.18)}" cy="${round(y - r * 0.2)}" r="${round(r * 0.16)}" fill="#fff"/>`
  );
}

/** 片側の翅（右側。左は反転して使う）。体の中心が原点、頭が上 */
const FORE = 'M1 -2C6 -12 16 -22 28 -24C30 -18 27 -8 20 -2C14 2 6 2 1 1Z';
const HIND = 'M1 1C8 2 17 4 19 11C20 17 13 20 8 17C4 14 1 8 1 1Z';
const WING =
  `<path d="${FORE}" fill="url(#fore)" stroke="#2a1d10" stroke-width="0.8"/>` +
  '<path d="M5 -5C10 -9 15 -8 23 -17M3 -1C10 -3 17 -3 24 -8" fill="none" stroke="#fff3d6" stroke-width="0.8" opacity="0.6"/>' +
  '<path d="M2 -1L26 -22M8 -1L24 -12" stroke="#4a3420" stroke-width="0.5" opacity="0.6"/>' +
  `<path d="${HIND}" fill="url(#hind)" stroke="#2a1d10" stroke-width="0.8"/>` +
  eyespot(10.6, 9.6, 3.8) +
  eyespot(18.4, -12.6, 2.3);

/** 蛾（体の中心・向き・大きさ。頭が上） */
export function moth(x: number, y: number, angle: number, scale: number): string {
  return (
    `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})" filter="url(#drop)">` +
    WING +
    `<g transform="scale(-1 1)">${WING}</g>` +
    '<ellipse cx="0" cy="2" rx="2.8" ry="9" fill="url(#body)" stroke="#20160c" stroke-width="0.6"/>' +
    '<path d="M-2.4 0H2.4M-2.6 3H2.6M-2.2 6H2.2" stroke="#3a2818" stroke-width="0.5"/>' +
    '<circle cx="0" cy="-7.6" r="2.4" fill="url(#body)" stroke="#20160c" stroke-width="0.5"/>' +
    '<path d="M-1 -9.6C-3 -14 -6 -16 -8 -16.6M1 -9.6C3 -14 6 -16 8 -16.6" fill="none" stroke="#2a1d10" stroke-width="0.9" stroke-linecap="round"/>' +
    '</g>'
  );
}
