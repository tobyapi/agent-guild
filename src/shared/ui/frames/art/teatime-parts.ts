// 「真夜中のお茶会」の部品（傾いた茶碗・匙・角砂糖・磁器の葉と花）。塗りは teatime.ts の defs の url(#…) を使う。

export const COBALT = '#2f4fa8';
export const COBALT_DARK = '#182a66';
export const TEA_INK = '#3a342c';

/** 茶碗（口が上・取っ手が左。中心・向き・大きさ） */
export function teacup(x: number, y: number, angle: number, scale: number): string {
  return (
    `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})" filter="url(#drop)">` +
    `<path d="M-15 -4C-24 -7 -26 6 -13 7" fill="none" stroke="#6e665a" stroke-width="4.6" stroke-linecap="round"/>` +
    `<path d="M-15 -4C-24 -7 -26 6 -13 7" fill="none" stroke="url(#porcelain)" stroke-width="3" stroke-linecap="round"/>` +
    '<path d="M-15.4 -9Q-15 8 -8 13Q0 16 8 13Q15 8 15.4 -9Z" fill="url(#cup)" stroke="#6e665a" stroke-width="0.8"/>' +
    `<path d="M-14.4 -1.6Q0 2.6 14.4 -1.6L13.8 2Q0 6.4 -13.8 2Z" fill="${COBALT}"/>` +
    '<path d="M-6 7.6L-3 5.6L0 7.6L3 5.6L6 7.6" fill="none" stroke="#2f4fa8" stroke-width="0.8"/>' +
    '<ellipse cx="0" cy="-9" rx="15.6" ry="4.4" fill="url(#gold)" stroke="#6e5410" stroke-width="0.6"/>' +
    '<ellipse cx="0" cy="-8.6" rx="13.8" ry="3.3" fill="url(#tea)"/>' +
    '<path d="M-11 -4Q-10.4 6 -6 10.6" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity="0.85"/>' +
    '</g>'
  );
}

/** 銀の匙（柄の端・向き・大きさ。皿が先） */
export function spoon(x: number, y: number, angle: number, scale: number): string {
  return (
    `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})" filter="url(#drop)">` +
    '<path d="M-1.6 0L-1 -22L1 -22L1.6 0Q0 2 -1.6 0Z" fill="url(#silver)" stroke="#4a505c" stroke-width="0.6"/>' +
    '<ellipse cx="0" cy="0" rx="2.4" ry="3" fill="url(#silver)" stroke="#4a505c" stroke-width="0.6"/>' +
    '<ellipse cx="0" cy="-29" rx="5.4" ry="7.8" fill="url(#silver)" stroke="#4a505c" stroke-width="0.7"/>' +
    '<ellipse cx="-1.4" cy="-30.6" rx="2" ry="4.2" fill="#fff" opacity="0.85"/></g>'
  );
}

/** 角砂糖 */
export function sugar(x: number, y: number): string {
  return (
    `<g transform="translate(${x} ${y})" stroke="#9a9286" stroke-width="0.45" stroke-linejoin="round" filter="url(#drop)">` +
    '<path d="M0 -4L6 -1.4L0 1.2L-6 -1.4Z" fill="#fff"/>' +
    '<path d="M-6 -1.4L0 1.2V8L-6 5.4Z" fill="#ddd6ca"/><path d="M6 -1.4L0 1.2V8L6 5.4Z" fill="#b9b1a4"/></g>'
  );
}

/** 呉須で縁取った磁器の葉（付け根・向き・大きさ） */
export function chinaLeaf(x: number, y: number, angle: number, scale: number): string {
  return (
    `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})">` +
    `<path d="M0 0C4 -3 5 -9 0 -14C-5 -9 -4 -3 0 0Z" fill="url(#porcelain)" stroke="${COBALT}" stroke-width="0.9"/>` +
    `<path d="M0 -1V-11" stroke="${COBALT}" stroke-width="0.6"/></g>`
  );
}

/** 呉須の小花（中心・大きさ） */
export function chinaFlower(x: number, y: number, r: number): string {
  const petals = [0, 72, 144, 216, 288]
    .map((a) => `<ellipse cx="0" cy="${-r * 0.6}" rx="${r * 0.42}" ry="${r * 0.6}" transform="rotate(${a})"/>`)
    .join('');
  return (
    `<g transform="translate(${x} ${y})" fill="${COBALT}" stroke="${COBALT_DARK}" stroke-width="0.5">${petals}` +
    `<circle r="${r * 0.32}" fill="url(#gold)"/></g>`
  );
}
