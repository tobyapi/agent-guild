// 枠の絵の defs の部品（グラデーションとフィルタ）。絵は <img> の中の独立した SVG なので、id は絵ごとに閉じる。
// 重いフィルタ（ぼかし・ノイズ）は絵ごとに数個まで。<img> は大きさごとに一度だけ描かれて使い回される。

/** [位置 0〜1, 色, 不透明度] */
export type Stop = [number, string, number?];

function stops(list: readonly Stop[]): string {
  return list
    .map(([offset, color, opacity]) =>
      opacity === undefined
        ? `<stop offset="${offset}" stop-color="${color}"/>`
        : `<stop offset="${offset}" stop-color="${color}" stop-opacity="${opacity}"/>`,
    )
    .join('');
}

/** 直線のグラデーション（既定は左上から右下へ。座標は図形の箱に対する割合） */
export function linear(id: string, list: readonly Stop[], [x1, y1, x2, y2] = [0, 0, 1, 1]): string {
  return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops(list)}</linearGradient>`;
}

/** 放射のグラデーション（中心・半径・光の中心。図形の箱に対する割合） */
export function radial(id: string, list: readonly Stop[], [cx, cy, r, fx, fy] = [0.5, 0.5, 0.5, 0.5, 0.5]): string {
  return `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}" fx="${fx}" fy="${fy}">${stops(list)}</radialGradient>`;
}

/** 放射のグラデーション（座標を絵の座標で指定する） */
export function radialAt(id: string, list: readonly Stop[], cx: number, cy: number, r: number): string {
  return `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${r}">${stops(list)}</radialGradient>`;
}

/** 落ち影（枠全体の下。ライトの紙の上でも輪郭が立つ） */
export const DROP_SHADOW =
  '<filter id="drop" x="-15%" y="-15%" width="130%" height="135%" color-interpolation-filters="sRGB">' +
  '<feDropShadow dx="0" dy="1.6" stdDeviation="1.4" flood-color="#000" flood-opacity="0.55"/></filter>';

/** ぼかし（光・影・湯気） */
export function blur(id: string, deviation: number): string {
  return `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${deviation}"/></filter>`;
}

/**
 * 素材の肌（細かなノイズを掛けて、形の内側だけに残す）。frequency は "x y"、strength は 0〜1（濃さ）。
 * 座標は絵の単位なので、大きさが変わっても模様の細かさは同じ
 */
export function grain(id: string, frequency: string, strength: number, seed = 2): string {
  const low = 1 - strength;
  return (
    `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${frequency}" numOctaves="3" seed="${seed}" result="noise"/>` +
    '<feColorMatrix in="noise" type="saturate" values="0" result="gray"/>' +
    `<feComponentTransfer in="gray" result="tone"><feFuncR type="linear" slope="${strength * 1.6}" intercept="${low}"/>` +
    `<feFuncG type="linear" slope="${strength * 1.6}" intercept="${low}"/>` +
    `<feFuncB type="linear" slope="${strength * 1.6}" intercept="${low}"/></feComponentTransfer>` +
    '<feBlend in="SourceGraphic" in2="tone" mode="multiply" result="mixed"/>' +
    '<feComposite in="mixed" in2="SourceAlpha" operator="in"/></filter>'
  );
}

/** 穴の内側の影（アバターの縁に落ちる、枠の厚みの影）。clip は穴の形の clipPath の id */
export function innerShadow(path: string, clip: string, opacity = 0.55): string {
  return `<g clip-path="url(#${clip})"><path d="${path}" fill-rule="evenodd" fill="#000" opacity="${opacity}" filter="url(#soft)"/></g>`;
}
