// 「風見の鴉」の部品（翼を上げた鴉・抜け落ちた羽根）。塗りは raven.ts の defs の url(#…) を使う。

export const RAVEN_INK = '#06070c';

/** 上げた翼（肩から右上へ。風切羽の先がぎざぎざ） */
const WING =
  'M2 -8C8 -16 16 -22 28 -24C27 -21 30 -20 33 -21C31 -18 33 -16 36 -16C33 -13 34 -11 37 -10C32 -7 26 -6 20 -6' +
  'C14 -5 8 -3 4 -1Z';

/** 鴉（左を向いて矢にとまる。足が原点。位置・大きさ） */
export function raven(x: number, y: number, scale: number): string {
  return (
    `<g transform="translate(${x} ${y}) scale(${scale})" filter="url(#drop)">` +
    '<g transform="scale(1 0.72)">' +
    `<path d="${WING}" fill="url(#raven)" stroke="#000" stroke-width="0.7" stroke-linejoin="round"/>` +
    '<path d="M8 -11C15 -16 22 -19 29 -21M10 -8C18 -11 26 -13 33 -14" fill="none" stroke="#9fb2ff" stroke-width="0.7" opacity="0.5"/></g>' +
    '<path d="M6 -6C12 -6 20 -3 30 4L28 7C20 3 13 2 7 2Z" fill="url(#raven)" stroke="#000" stroke-width="0.6"/>' +
    '<path d="M-10 -13C-7 -19 2 -18 7 -12C11 -7 10 -1 6 1C1 3 -6 1 -9 -3C-11 -6 -11 -10 -10 -13Z" fill="url(#raven)" stroke="#000" stroke-width="0.6"/>' +
    '<path d="M-2 -10C3 -11 7 -8 8 -3C9 1 15 5 20 8C13 6 7 3 4 1C0 -2 -2 -5 -2 -10Z" fill="#14172a" stroke="#000" stroke-width="0.5"/>' +
    '<circle cx="-9" cy="-14" r="5.2" fill="url(#raven)" stroke="#000" stroke-width="0.6"/>' +
    '<path d="M-13 -16.4L-22 -13.4L-13.4 -11.8Z" fill="url(#beak)" stroke="#000" stroke-width="0.5" stroke-linejoin="round"/>' +
    '<circle cx="-10.2" cy="-15" r="1.4" fill="url(#eye)"/><circle cx="-10.5" cy="-15.3" r="0.45" fill="#fff"/>' +
    '<path d="M-12 -18.4C-9 -19.6 -6 -19 -4.4 -17" fill="none" stroke="#b8c6ff" stroke-width="0.7" opacity="0.6"/>' +
    '<path d="M-3 1L-4 0.6M-1 1V0M2 1L1 0.6" stroke="#2a2a2a" stroke-width="0.9" stroke-linecap="round"/>' +
    '</g>'
  );
}

/** 抜け落ちた羽根（中心・向き・大きさ） */
export function feather(x: number, y: number, angle: number, scale: number): string {
  return (
    `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})">` +
    '<path d="M0 -14C4 -10 5 -2 4 6C3 10 1 13 0 14C-1 11 -3 8 -4 4C-5 -3 -4 -10 0 -14Z" fill="url(#raven)" stroke="#000" stroke-width="0.6"/>' +
    '<path d="M0 -12V17" stroke="#7d86a8" stroke-width="0.7"/>' +
    '<path d="M0 -6L3.4 -8.6M0 -1L4 -3.6M0 4L3.6 1.8M0 -4L-3.4 -6.6M0 1L-3.8 -1M0 6L-3.4 4.4" stroke="#465078" stroke-width="0.45"/>' +
    '<path d="M-2.4 2L-5 3.4M2.6 7L4.6 9" stroke="#2a2e44" stroke-width="0.8"/></g>'
  );
}
