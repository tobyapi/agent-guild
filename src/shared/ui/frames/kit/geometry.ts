// 枠の絵の座標（viewBox 0 0 128 128）。アバターは中央の角丸の正方形（20〜108・角の半径 10）にちょうど収まり、
// 枠の帯はその外側（だいたい 8〜22。内側の縁はアバターの縁に 2 だけ重ねて継ぎ目を隠す）に描く。
// 生成した枠も同じ形で描く（Rust の guild-domain frame/prompt.rs が同じ数を AI に伝える）。

export const SIZE = 128;
/** アバターが入る穴（角丸の正方形）の、外からの距離 */
export const OPENING = 20;
/** 穴の角の半径 */
export const OPENING_RADIUS = 10;

const n = (value: number) => Number(value.toFixed(2));

/** 角丸の正方形（inset から 128 - inset まで。時計回り） */
export function square(inset: number, radius: number): string {
  const a = n(inset);
  const b = n(SIZE - inset);
  const r = n(radius);
  return (
    `M${n(a + r)} ${a}H${n(b - r)}A${r} ${r} 0 0 1 ${b} ${n(a + r)}V${n(b - r)}A${r} ${r} 0 0 1 ${n(b - r)} ${b}` +
    `H${n(a + r)}A${r} ${r} 0 0 1 ${a} ${n(b - r)}V${n(a + r)}A${r} ${r} 0 0 1 ${n(a + r)} ${a}Z`
  );
}

/** 縁の帯（外形と穴。fill-rule="evenodd" で塗る） */
export function band(outer: number, outerRadius: number, inner: number, innerRadius: number): string {
  return `${square(outer, outerRadius)} ${square(inner, innerRadius)}`;
}

/** 点 (cx, cy) を中心にした、半径 r の円周上の点 */
export function polar(cx: number, cy: number, r: number, degrees: number): [number, number] {
  const rad = ((degrees - 90) * Math.PI) / 180;
  return [n(cx + r * Math.cos(rad)), n(cy + r * Math.sin(rad))];
}

export { n as round };
