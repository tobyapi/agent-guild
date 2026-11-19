import { expect, it } from 'vitest';
import { ColorEnvelope } from './envelope';

it('bounds luminance at all eight corners after repeated alpha blending', () => {
  for (const alpha of [0, 0.001, 0.04, 0.5, 0.942, 0.999, 1]) {
    const box = ColorEnvelope.fullRgb().over([0.04, 0.7, 0.1], alpha).over([0.9, 0.02, 0.5], 0.35);
    const values = box.corners().map((rgb) => {
      const linear = rgb.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
    });
    expect(box.luminanceRange()).toEqual([Math.min(...values), Math.max(...values)]);
  }
});
