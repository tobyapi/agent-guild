// 「樫の額縁」の小さな部品（樫の葉・どんぐり）。塗りは oak.ts の defs の url(#…) を使う。

export const OAK_INK = '#1a0e06';
const LEAF_DARK = '#1f2a0c';

/** 樫の葉（付け根が (0, 12)、先が (0, -12)） */
const LEAF =
  'M0 -12C3 -11.5 4.6 -9.4 3.2 -7.2C6.6 -7.4 7.6 -3.8 4.3 -2C7.8 -1.4 7.8 2.4 4.4 3.2C6.6 5.6 5 8.6 1.8 8L0.9 12H-0.9' +
  'L-1.8 8C-5 8.6 -6.6 5.6 -4.4 3.2C-7.8 2.4 -7.8 -1.4 -4.3 -2C-7.6 -3.8 -6.6 -7.4 -3.2 -7.2C-4.6 -9.4 -3 -11.5 0 -12Z';
const VEINS = 'M0 11V-10M0 -5L3.4 -7M0 -5L-3.4 -7M0 0L4.4 -2M0 0L-4.4 -2M0 5L4 3.4M0 5L-4 3.4';

/** 葉（付け根の位置・向き・大きさ・塗り） */
export function leaf(x: number, y: number, angle: number, scale: number, fill = 'url(#leaf)'): string {
  return (
    `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${scale}) translate(0 -12)">` +
    `<path d="${LEAF}" fill="${fill}" stroke="${LEAF_DARK}" stroke-width="0.8" stroke-linejoin="round"/>` +
    `<path d="${VEINS}" fill="none" stroke="${LEAF_DARK}" stroke-width="0.5" opacity="0.7"/>` +
    '<path d="M-0.8 -10C-2.8 -7 -3.8 -2 -2.6 4" fill="none" stroke="#f0f6b0" stroke-width="0.8" opacity="0.5"/></g>'
  );
}

/** どんぐり（軸の付け根の位置・向き・大きさ） */
export function acorn(x: number, y: number, angle: number, scale: number): string {
  return (
    `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${scale}) translate(0 7)">` +
    `<ellipse cx="0" cy="1.4" rx="3.7" ry="4.7" fill="url(#nut)" stroke="${OAK_INK}" stroke-width="0.6"/>` +
    '<ellipse cx="-1.3" cy="0.6" rx="0.9" ry="1.8" fill="#fff" opacity="0.5"/>' +
    `<path d="M-4.6 -0.6C-4.8 -5.6 4.8 -5.6 4.6 -0.6Q0 1.1 -4.6 -0.6Z" fill="url(#cap)" stroke="${OAK_INK}" stroke-width="0.6"/>` +
    '<path d="M-3.4 -2.6L-1 -0.4M-1.4 -4L2 -0.6M1.2 -4.4L3.8 -1.8M-3.6 -1L-0.6 -4.2M0.6 -0.4L3.4 -3.6" stroke="#2c1a0a" stroke-width="0.45"/>' +
    '<path d="M0 -4.2Q0.4 -6 0 -7" fill="none" stroke="#5a3a1c" stroke-width="1.1" stroke-linecap="round"/></g>'
  );
}

/** 折れた枝の切り口（年輪） */
export function stump(x: number, y: number, rx: number, ry: number, angle: number): string {
  return (
    `<g transform="translate(${x} ${y}) rotate(${angle})">` +
    `<ellipse rx="${rx}" ry="${ry}" fill="#d8b07a" stroke="${OAK_INK}" stroke-width="0.8"/>` +
    `<ellipse rx="${rx * 0.62}" ry="${ry * 0.62}" fill="none" stroke="#8a5a2c" stroke-width="0.6"/>` +
    `<ellipse rx="${rx * 0.28}" ry="${ry * 0.28}" fill="#8a5a2c"/></g>`
  );
}

/** 幹のこぶの洞（うろ） */
export function knot(x: number, y: number, rx: number, ry: number, angle: number): string {
  return (
    `<g transform="translate(${x} ${y}) rotate(${angle})">` +
    `<ellipse rx="${rx + 1.4}" ry="${ry + 1.4}" fill="url(#bark)" stroke="${OAK_INK}" stroke-width="0.7"/>` +
    `<ellipse rx="${rx}" ry="${ry}" fill="#140a04"/>` +
    `<path d="M${-rx - 0.8} 0A${rx + 0.8} ${ry + 0.8} 0 0 1 ${rx + 0.8} 0" fill="none" stroke="#e0b880" stroke-width="0.7" opacity="0.7"/></g>`
  );
}
