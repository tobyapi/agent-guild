// いくつかの絵で使う小さな意匠（歯車・きらめき・鋲・葉）。座標は絵の単位。
import { polar, round } from './geometry';

/** 歯車の外形（中心・歯の付け根の半径・歯先の半径・歯の数）。穴は hole で足して evenodd で抜く */
export function gear(cx: number, cy: number, inner: number, outer: number, teeth: number, phase = 0): string {
  const step = 360 / teeth;
  const points = Array.from({ length: teeth }, (_, index) => {
    const a = phase + index * step;
    return [
      polar(cx, cy, inner, a - step * 0.32),
      polar(cx, cy, outer, a - step * 0.16),
      polar(cx, cy, outer, a + step * 0.16),
      polar(cx, cy, inner, a + step * 0.32),
    ];
  }).flat();
  return `M${points.map(([x, y]) => `${x} ${y}`).join('L')}Z`;
}

/** 円（evenodd の穴に使う） */
export function circle(cx: number, cy: number, r: number): string {
  return `M${round(cx - r)} ${cy}a${r} ${r} 0 1 0 ${round(r * 2)} 0a${r} ${r} 0 1 0 ${round(-r * 2)} 0Z`;
}

/** 4つの尖りのきらめき（中心と大きさ） */
export function sparkle(cx: number, cy: number, size: number, fill: string, opacity = 1): string {
  const s = size;
  const w = size * 0.22;
  return (
    `<path d="M${cx} ${round(cy - s)}Q${round(cx + w)} ${round(cy - w)} ${round(cx + s)} ${cy}` +
    `Q${round(cx + w)} ${round(cy + w)} ${cx} ${round(cy + s)}Q${round(cx - w)} ${round(cy + w)} ${round(cx - s)} ${cy}` +
    `Q${round(cx - w)} ${round(cy - w)} ${cx} ${round(cy - s)}Z" fill="${fill}" opacity="${opacity}"/>`
  );
}

/** 丸い鋲（照りと陰のある半球）。fill は放射グラデーションの url(#id) */
export function rivet(cx: number, cy: number, r: number, fill: string, rim = '#1a120a'): string {
  return (
    `<circle cx="${cx}" cy="${round(cy + r * 0.35)}" r="${r}" fill="#000" opacity="0.45"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${rim}" stroke-width="${round(r * 0.28)}"/>` +
    `<circle cx="${round(cx - r * 0.35)}" cy="${round(cy - r * 0.35)}" r="${round(r * 0.32)}" fill="#fff" opacity="0.75"/>`
  );
}
