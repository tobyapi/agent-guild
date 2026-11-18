import { ColorEnvelope, type Rgb } from '../lib/themeBackdrop/envelope';

export function rgb(hex: string): Rgb {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}
export function mix(base: string, ink: string, weight: number): string {
  const a = rgb(base),
    b = rgb(ink);
  return (
    '#' +
    a
      .map((v, i) =>
        Math.round(255 * (v * (1 - weight) + b[i]! * weight))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
export const solid = (color: string) => ColorEnvelope.fullRgb().over(rgb(color), 1);

export function worstRatio(ink: string, bounds: ColorEnvelope): number {
  const [low, high] = bounds.luminanceRange();
  const [value] = solid(ink).luminanceRange();
  if (value < low) return (low + 0.05) / (value + 0.05);
  if (value > high) return (value + 0.05) / (high + 0.05);
  return 1;
}
export function buttonInk(fill: string) {
  return worstRatio('#ffffff', solid(fill)) > worstRatio('#000000', solid(fill)) ? '#ffffff' : '#000000';
}
