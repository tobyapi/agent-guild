import { describe, expect, it } from 'vitest';
import {
  clampView,
  cropKeyAction,
  imagePlacement,
  initialView,
  panView,
  sourceRect,
  wheelZoomFactor,
  zoomView,
  zoomViewCentered,
  ZOOM_STEP,
} from './crop';

const FRAME = 200;
const wide = { width: 400, height: 200 };
const tall = { width: 100, height: 300 };

describe('initialView', () => {
  it('倍率 1 は枠を覆う最小の倍率で、中央に置く', () => {
    expect(initialView(wide, FRAME)).toEqual({ zoom: 1, x: -100, y: 0 });
    expect(initialView(tall, FRAME)).toEqual({ zoom: 1, x: 0, y: -200 });
  });
});

describe('clampView / panView', () => {
  it('画像が枠を覆うように位置を制限する（余白を出さない）', () => {
    const start = initialView(wide, FRAME);
    expect(panView(start, 500, 50, wide, FRAME)).toEqual({ zoom: 1, x: 0, y: 0 });
    expect(panView(start, -500, -50, wide, FRAME)).toEqual({ zoom: 1, x: -200, y: 0 });
    expect(panView(start, 30, 0, wide, FRAME)).toEqual({ zoom: 1, x: -70, y: 0 });
  });

  it('倍率は 1〜4 に収める', () => {
    expect(clampView({ zoom: 0.5, x: 0, y: 0 }, wide, FRAME).zoom).toBe(1);
    expect(clampView({ zoom: 9, x: 0, y: 0 }, wide, FRAME).zoom).toBe(4);
  });
});

describe('zoomView', () => {
  it('指した点の下にある画像の点が、拡大のあとも同じ場所に残る', () => {
    const start = initialView(wide, FRAME);
    const point = { x: 150, y: 50 };
    const zoomed = zoomView(start, 2, point, wide, FRAME);
    // 拡大前の点 (150, 50) は画像の (250, 50)。倍率 2 で枠の px ＝ 画像の px × 2
    expect(zoomed).toEqual({ zoom: 2, x: 150 - 250 * 2, y: 50 - 50 * 2 });
  });

  it('拡大の中心が端に寄っていても、余白が出ないよう位置を制限する', () => {
    const zoomedOut = zoomView({ zoom: 3, x: -600, y: -400 }, 1, { x: 0, y: 0 }, wide, FRAME);
    expect(zoomedOut).toEqual({ zoom: 1, x: -200, y: 0 });
  });

  it('中央を中心に拡大する（スライダー・キーボード）', () => {
    expect(zoomViewCentered(initialView(wide, FRAME), 2, wide, FRAME)).toEqual({ zoom: 2, x: -300, y: -100 });
  });
});

describe('sourceRect / imagePlacement', () => {
  it('枠に見えている範囲を画像の px の正方形で返す', () => {
    expect(sourceRect(initialView(wide, FRAME), wide, FRAME)).toEqual({ sx: 100, sy: 0, size: 200 });
    expect(sourceRect({ zoom: 2, x: -300, y: -100 }, wide, FRAME)).toEqual({ sx: 150, sy: 50, size: 100 });
    expect(sourceRect(initialView(tall, FRAME), tall, FRAME)).toEqual({ sx: 0, sy: 100, size: 100 });
  });

  it('画像の置き場所を枠に対するパーセントにする', () => {
    expect(imagePlacement(initialView(wide, FRAME), wide, FRAME)).toEqual({
      left: '-50%',
      top: '0%',
      width: '200%',
      height: '100%',
    });
  });
});

describe('cropKeyAction / wheelZoomFactor', () => {
  it('矢印で動かし（Shift で大きく）、+ / − で拡大・縮小する', () => {
    expect(cropKeyAction('ArrowLeft', false)).toEqual({ type: 'pan', dx: -8, dy: 0 });
    expect(cropKeyAction('ArrowDown', true)).toEqual({ type: 'pan', dx: 0, dy: 40 });
    expect(cropKeyAction('+', false)).toEqual({ type: 'zoom', factor: ZOOM_STEP });
    expect(cropKeyAction('-', false)).toEqual({ type: 'zoom', factor: 1 / ZOOM_STEP });
    expect(cropKeyAction('Enter', false)).toBeNull();
  });

  it('ホイールを上に回すと拡大、下に回すと縮小', () => {
    expect(wheelZoomFactor(-100)).toBeGreaterThan(1);
    expect(wheelZoomFactor(100)).toBeLessThan(1);
    expect(wheelZoomFactor(0)).toBe(1);
  });
});
