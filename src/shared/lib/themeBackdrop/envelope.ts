import { reject } from './checks';
import { validateRecipeStructure } from './structure';

export type Rgb = readonly [number, number, number];
export interface ColorExpansion {
  underlay: Rgb | null;
  usesBlackShadow: boolean;
}
export function validRgb(rgb: Rgb): boolean {
  return rgb.length === 3 && rgb.every((v) => Number.isFinite(v) && v >= 0 && v <= 1);
}

export class ColorEnvelope {
  private constructor(
    private readonly low: Rgb,
    private readonly high: Rgb,
  ) {}

  static fullRgb(): ColorEnvelope {
    return new ColorEnvelope([0, 0, 0], [1, 1, 1]);
  }

  /** Outward rounding bounds the compositor's 8-bit result. */
  roundedOut(): ColorEnvelope {
    const scale = (v: number, delta: number) => Math.max(0, Math.min(1, v + delta / 510));
    return new ColorEnvelope(
      [scale(this.low[0], -1), scale(this.low[1], -1), scale(this.low[2], -1)],
      [scale(this.high[0], 1), scale(this.high[1], 1), scale(this.high[2], 1)],
    );
  }

  static fromRecipe(recipe: unknown, scheme: string, expansion: ColorExpansion): ColorEnvelope {
    validateRecipeStructure(recipe);
    if (!['dark', 'light'].includes(scheme)) reject('palette', 'invalid_scheme');
    if (expansion.underlay && !validRgb(expansion.underlay)) reject('$', 'invalid_expansion');
    const palettes = (recipe as { palette: Record<string, string[]> }).palette;
    const colors: Rgb[] = palettes[scheme]!.map((color) => [
      parseInt(color.slice(1, 3), 16) / 255,
      parseInt(color.slice(3, 5), 16) / 255,
      parseInt(color.slice(5, 7), 16) / 255,
    ]);
    if (expansion.underlay) colors.push(expansion.underlay);
    if (expansion.usesBlackShadow) colors.push([0, 0, 0]);
    const bounds = (operation: (...values: number[]) => number): Rgb => [
      operation(...colors.map((c) => c[0])),
      operation(...colors.map((c) => c[1])),
      operation(...colors.map((c) => c[2])),
    ];
    return new ColorEnvelope(bounds(Math.min), bounds(Math.max));
  }

  corners(): Rgb[] {
    return Array.from({ length: 8 }, (_, mask) => [
      mask & 1 ? this.high[0] : this.low[0],
      mask & 2 ? this.high[1] : this.low[1],
      mask & 4 ? this.high[2] : this.low[2],
    ]);
  }

  over(color: Rgb, alpha: number): ColorEnvelope {
    const blend = (bound: Rgb): Rgb =>
      ([0, 1, 2] as const).map((i) => alpha * color[i] + (1 - alpha) * bound[i]) as unknown as Rgb;
    return new ColorEnvelope(blend(this.low), blend(this.high));
  }

  luminanceRange(): readonly [number, number] {
    // sRGB luminance increases in every channel, so the two bounds contain both extrema.
    const values = [luminance(this.low), luminance(this.high)];
    return [Math.min(...values), Math.max(...values)];
  }
}

function luminance(rgb: Rgb): number {
  const linear = rgb.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}
