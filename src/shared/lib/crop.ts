// アバターの切り抜きの計算（純粋な関数）。座標は正方形の作業枠の px（左上が原点）で表す。
// 画像はいつも枠を覆い（余白を出さない）、倍率 1 は「枠を覆う最小の倍率」。

/** 作業枠の一辺（px）。表示が縮んでも計算はこの大きさで行い、画面ではパーセントで置く */
export const CROP_FRAME_SIZE = 280;
export const CROP_ZOOM_MIN = 1;
export const CROP_ZOOM_MAX = 4;

export interface ImageSize {
  width: number;
  height: number;
}

export interface CropView {
  /** CROP_ZOOM_MIN〜CROP_ZOOM_MAX */
  zoom: number;
  /** 画像の左上の位置（枠の px。枠を覆うので常に 0 以下） */
  x: number;
  y: number;
}

/** drawImage に渡す切り抜き元（画像の px の正方形） */
export interface SourceRect {
  sx: number;
  sy: number;
  size: number;
}

export interface Point {
  x: number;
  y: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** 枠の px ÷ 画像の px（倍率込み） */
export function cropScale(image: ImageSize, zoom: number, frame = CROP_FRAME_SIZE): number {
  return (frame / Math.min(image.width, image.height)) * zoom;
}

/** 倍率を範囲に収め、画像が枠を覆うように位置を制限する */
export function clampView(view: CropView, image: ImageSize, frame = CROP_FRAME_SIZE): CropView {
  const zoom = clamp(view.zoom, CROP_ZOOM_MIN, CROP_ZOOM_MAX);
  const scale = cropScale(image, zoom, frame);
  return {
    zoom,
    x: clamp(view.x, frame - image.width * scale, 0),
    y: clamp(view.y, frame - image.height * scale, 0),
  };
}

/** 最初の状態（と「元に戻す」）: 中央・最小倍率 */
export function initialView(image: ImageSize, frame = CROP_FRAME_SIZE): CropView {
  const scale = cropScale(image, CROP_ZOOM_MIN, frame);
  return { zoom: CROP_ZOOM_MIN, x: (frame - image.width * scale) / 2, y: (frame - image.height * scale) / 2 };
}

/** 動かす（枠の px） */
export function panView(view: CropView, dx: number, dy: number, image: ImageSize, frame = CROP_FRAME_SIZE): CropView {
  return clampView({ ...view, x: view.x + dx, y: view.y + dy }, image, frame);
}

/** 倍率を変える。point（枠の px）の下にある画像の点が、変えたあとも同じ場所に残るようにする */
export function zoomView(
  view: CropView,
  zoom: number,
  point: Point,
  image: ImageSize,
  frame = CROP_FRAME_SIZE,
): CropView {
  const before = cropScale(image, view.zoom, frame);
  const after = cropScale(image, clamp(zoom, CROP_ZOOM_MIN, CROP_ZOOM_MAX), frame);
  const ratio = after / before;
  return clampView(
    { zoom, x: point.x - (point.x - view.x) * ratio, y: point.y - (point.y - view.y) * ratio },
    image,
    frame,
  );
}

/** 枠の中央を中心に倍率を変える（スライダー・キーボード） */
export function zoomViewCentered(view: CropView, zoom: number, image: ImageSize, frame = CROP_FRAME_SIZE): CropView {
  return zoomView(view, zoom, { x: frame / 2, y: frame / 2 }, image, frame);
}

/** 枠に見えている範囲を、画像の px の正方形にする（端の丸めの誤差で画像からはみ出さないよう収める） */
export function sourceRect(view: CropView, image: ImageSize, frame = CROP_FRAME_SIZE): SourceRect {
  const scale = cropScale(image, view.zoom, frame);
  const size = Math.min(frame / scale, image.width, image.height);
  return {
    sx: clamp(-view.x / scale, 0, image.width - size),
    sy: clamp(-view.y / scale, 0, image.height - size),
    size,
  };
}

/** 画像の置き場所を枠に対するパーセントで（作業枠と大きさの違うプレビューで同じ値を使える） */
export function imagePlacement(view: CropView, image: ImageSize, frame = CROP_FRAME_SIZE) {
  const scale = cropScale(image, view.zoom, frame);
  const percent = (value: number) => `${(value / frame) * 100}%`;
  return {
    left: percent(view.x),
    top: percent(view.y),
    width: percent(image.width * scale),
    height: percent(image.height * scale),
  };
}

/** キー操作: 矢印で動かす（Shift で大きく）、+ / − で拡大・縮小。関係のないキーは null */
export type CropKeyAction = { type: 'pan'; dx: number; dy: number } | { type: 'zoom'; factor: number };

const PAN_STEP = 8;
const PAN_STEP_LARGE = 40;
export const ZOOM_STEP = 1.1;

export function cropKeyAction(key: string, shiftKey: boolean): CropKeyAction | null {
  const step = shiftKey ? PAN_STEP_LARGE : PAN_STEP;
  const pans: Record<string, [number, number]> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  };
  const pan = pans[key];
  if (pan) return { type: 'pan', dx: pan[0], dy: pan[1] };
  if (key === '+' || key === '=' || key === 'Add') return { type: 'zoom', factor: ZOOM_STEP };
  if (key === '-' || key === '_' || key === 'Subtract') return { type: 'zoom', factor: 1 / ZOOM_STEP };
  return null;
}

/** ホイールの量を倍率の掛け算にする（上に回すと拡大） */
export function wheelZoomFactor(deltaY: number): number {
  return Math.exp(-deltaY * 0.0015);
}
