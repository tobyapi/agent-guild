// 曲がる帯の部品: 点を滑らかにつなぐ線と、太さの変わる帯（枝・管・綱・蔓・布）。座標は絵の単位。
import { round } from './geometry';

/** 点（x, y） */
export type Pt = readonly [number, number];
/** 太さ付きの点（x, y, 太さ）。太さ 0 で先が尖る */
export type WPt = readonly [number, number, number];

const f = ([x, y]: Pt) => `${round(x)} ${round(y)}`;

function at<T>(points: readonly T[], index: number, closed: boolean): T {
  const count = points.length;
  const i = closed ? (index + count) % count : Math.max(0, Math.min(count - 1, index));
  return points[i] as T;
}

/** 点を通る滑らかな曲線の続き（Catmull-Rom を 3 次ベジエに直す。M は付けない） */
function curve(points: readonly Pt[], closed: boolean): string {
  const segments = closed ? points.length : points.length - 1;
  let d = '';
  for (let i = 0; i < segments; i += 1) {
    const [p0, p1, p2, p3] = [-1, 0, 1, 2].map((k) => at(points, i + k, closed)) as [Pt, Pt, Pt, Pt];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1)} ${f(c2)} ${f(p2)}`;
  }
  return d;
}

/** 点を通る滑らかな線（closed で輪にする） */
export function smooth(points: readonly Pt[], closed = false): string {
  const first = points[0];
  if (!first) return '';
  return `M${f(first)}${curve(points, closed)}${closed ? 'Z' : ''}`;
}

/** 各点の、進む向きに直交する単位ベクトル */
function normals(points: readonly WPt[], closed: boolean): Pt[] {
  return points.map((_, i) => {
    const a = at(points, i - 1, closed);
    const b = at(points, i + 1, closed);
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const length = Math.hypot(dx, dy) || 1;
    return [-dy / length, dx / length];
  });
}

/** 中心線を横へずらした点（side は太さに対する割合。正で左手側） */
function offset(points: readonly WPt[], side: number, closed: boolean, shift = 0): Pt[] {
  const ns = normals(points, closed);
  return points.map(([x, y, w], i) => {
    const [nx, ny] = ns[i] ?? [0, 0];
    return [x + nx * (w * side + shift), y + ny * (w * side + shift)];
  });
}

/** 太さの変わる帯の外形（端は丸める。太さ 0 の端は尖る） */
export function ribbon(points: readonly WPt[]): string {
  const left = offset(points, 0.5, false);
  const right = offset(points, -0.5, false).reverse();
  const end = points[points.length - 1]?.[2] ?? 0;
  const start = points[0]?.[2] ?? 0;
  const cap = (w: number, to: Pt) => (w > 0.2 ? `A${round(w / 2)} ${round(w / 2)} 0 0 0 ${f(to)}` : `L${f(to)}`);
  const [l0, r0] = [left[0], right[0]];
  if (!l0 || !r0) return '';
  return `M${f(l0)}${curve(left, false)}${cap(end, r0)}${curve(right, false)}${cap(start, l0)}Z`;
}

/** 輪になった帯（外の縁と内の縁。fill-rule="evenodd" で塗る） */
export function loop(points: readonly WPt[]): string {
  return `${smooth(offset(points, 0.5, true), true)}${smooth(offset(points, -0.5, true), true)}`;
}

/** 光の来る向き（左上）に面した側へずらした、細い照りの帯 */
export function sheen(points: readonly WPt[], amount = 0.3, closed = false): string {
  const ns = normals(points, closed);
  const light: Pt = [-0.55, -0.84];
  const lit = points.map(([x, y, w], i): WPt => {
    const [nx, ny] = ns[i] ?? [0, 0];
    const facing = nx * light[0] + ny * light[1];
    return [x + nx * facing * w * 0.26, y + ny * facing * w * 0.26, w * amount * Math.max(0.15, Math.abs(facing))];
  });
  return closed ? loop(lit) : ribbon(lit);
}

export interface TubeStyle {
  fill: string;
  ink: string;
  light?: string;
  inkWidth?: number;
  lightOpacity?: number;
}

/** 立体の帯（塗り・暗い輪郭・照り）。枝・管・蔓・角など */
export function tube(points: readonly WPt[], style: TubeStyle): string {
  const { fill, ink, light = '#fff', inkWidth = 0.9, lightOpacity = 0.55 } = style;
  return (
    `<path d="${ribbon(points)}" fill="${fill}" stroke="${ink}" stroke-width="${inkWidth}" stroke-linejoin="round"/>` +
    `<path d="${sheen(points)}" fill="${light}" opacity="${lightOpacity}"/>`
  );
}

/** 点の列を (dx, dy) だけ動かす */
export function shift<T extends Pt | WPt>(points: readonly T[], dx: number, dy: number): T[] {
  return points.map((p) => [p[0] + dx, p[1] + dy, ...p.slice(2)] as unknown as T);
}

/** 帯の中心線から横へずらした線（木目・縫い目・筋。side は太さに対する割合） */
export function along(points: readonly WPt[], side: number, closed = false): string {
  return smooth(offset(points, side, closed), closed);
}

/**
 * 渦（外から内へ巻き込む点の列。鉄の唐草・蔓の巻きひげ）。start は外の端の角度（度。上が 0 で時計回り）、
 * turn は巻く量（周。負で反時計回り）。太さは width から内へ細る
 */
export function spiral(cx: number, cy: number, radius: number, start: number, turn: number, width: number): WPt[] {
  const count = Math.max(6, Math.round(Math.abs(turn) * 14));
  return Array.from({ length: count + 1 }, (_, i): WPt => {
    const t = i / count;
    const r = radius * (1 - t * 0.78);
    const a = ((start + turn * 360 * t - 90) * Math.PI) / 180;
    return [round(cx + r * Math.cos(a)), round(cy + r * Math.sin(a)), round(width * (1 - t * 0.75))];
  });
}
