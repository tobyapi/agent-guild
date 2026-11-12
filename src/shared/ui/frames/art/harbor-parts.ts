// 「港の綱」の部品（錨・係船柱・ガラスの浮き玉・ヒトデ）。塗りは harbor.ts の defs の url(#…) を使う。
import { polar, round } from '../kit/geometry';

export const HARBOR_INK = '#0e1418';

/** 錨（環が (0, -17)、爪が下。位置・向き・大きさ） */
export function anchor(x: number, y: number, angle: number, scale: number): string {
  return (
    `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})" filter="url(#drop)">` +
    `<g fill="url(#iron)" stroke="${HARBOR_INK}" stroke-width="0.8" stroke-linejoin="round">` +
    '<path d="M0 -21.4A4.4 4.4 0 1 1 0 -12.6A4.4 4.4 0 1 1 0 -21.4ZM0 -19A2 2 0 1 0 0 -15A2 2 0 1 0 0 -19Z" fill-rule="evenodd"/>' +
    '<rect x="-12" y="-12.8" width="24" height="3.6" rx="1.8"/>' +
    '<path d="M-2.2 -13L2.2 -13L2.6 14L-2.6 14Z"/>' +
    '<path d="M-17 1Q-16 19 0 20Q16 19 17 1L13.6 2Q12.6 15 0 15.8Q-12.6 15 -13.6 2Z"/>' +
    '<path d="M-17.6 -3L-22 7L-11.6 5.6Z"/><path d="M17.6 -3L22 7L11.6 5.6Z"/>' +
    '<circle cx="0" cy="17.4" r="3"/></g>' +
    '<path d="M-1 -12V12M-15 3Q-14 16.6 0 18" fill="none" stroke="#e6edf4" stroke-width="0.8" opacity="0.5"/>' +
    '<path d="M-11 -12H8" stroke="#e6edf4" stroke-width="0.7" opacity="0.5"/></g>'
  );
}

/** 係船柱（鉄の短い柱。足もとの中心・大きさ） */
export function bollard(x: number, y: number, scale: number): string {
  return (
    `<g transform="translate(${x} ${y}) scale(${scale})" filter="url(#drop)">` +
    `<path d="M-9 0V-18Q-9 -22 -7 -24H7Q9 -22 9 -18V0Z" fill="url(#ironV)" stroke="${HARBOR_INK}" stroke-width="0.8"/>` +
    `<ellipse cx="0" cy="-25" rx="11.5" ry="4.2" fill="url(#iron)" stroke="${HARBOR_INK}" stroke-width="0.8"/>` +
    '<ellipse cx="-2.4" cy="-26" rx="5" ry="1.4" fill="#e6edf4" opacity="0.45"/>' +
    '<path d="M-6 -2V-18" stroke="#e6edf4" stroke-width="1" opacity="0.35"/></g>'
  );
}

/** ガラスの浮き玉（網に包まれた緑のガラス） */
export function glassFloat(cx: number, cy: number, r: number): string {
  const strings = [-0.5, 0, 0.5]
    .map(
      (t) =>
        `M${round(cx - r)} ${round(cy + r * t)}Q${cx} ${round(cy + r * t + r * 0.5)} ${round(cx + r)} ${round(cy + r * t)}`,
    )
    .join('');
  return (
    `<g filter="url(#drop)"><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#glass)" stroke="#0a2a24" stroke-width="0.9"/>` +
    `<path d="${strings}M${cx} ${round(cy - r)}V${round(cy + r)}" fill="none" stroke="#e8d8a8" stroke-width="0.8" opacity="0.85"/>` +
    `<ellipse cx="${round(cx - r * 0.38)}" cy="${round(cy - r * 0.42)}" rx="${round(r * 0.3)}" ry="${round(r * 0.18)}"` +
    ` transform="rotate(-35 ${round(cx - r * 0.38)} ${round(cy - r * 0.42)})" fill="#fff" opacity="0.85"/></g>`
  );
}

/** ヒトデ（5本の腕。中心・外の半径・内の半径・回転） */
export function starfish(cx: number, cy: number, outer: number, inner: number, turn: number): string {
  const points = Array.from({ length: 10 }, (_, index) =>
    polar(cx, cy, index % 2 === 0 ? outer : inner, turn + index * 36),
  );
  const d = points
    .map(([x, y], index) => {
      if (index === 0) return `M${x} ${y}`;
      const [px, py] = points[index - 1] ?? [x, y];
      return `Q${round((px + x) / 2 + (x - cx) * 0.08)} ${round((py + y) / 2 + (y - cy) * 0.08)} ${x} ${y}`;
    })
    .join('');
  return (
    `<g filter="url(#drop)"><path d="${d}Z" fill="url(#star)" stroke="#6a1e0c" stroke-width="0.8" stroke-linejoin="round"/>` +
    `<circle cx="${cx}" cy="${cy}" r="1.6" fill="#6a1e0c" opacity="0.6"/></g>`
  );
}
