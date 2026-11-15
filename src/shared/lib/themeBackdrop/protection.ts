import { reject } from './checks';
import { ColorEnvelope, validRgb } from './envelope';
import type { Rgb } from './envelope';

export interface Rgba {
  rgb: Rgb;
  alpha: number;
}
export interface TextState {
  text: Rgba;
  overlays: readonly Rgba[];
}
export interface Protection {
  alpha: number;
  verified: boolean;
}

export function resolveTextProtection(
  envelope: ColorEnvelope,
  surface: Rgb | null,
  states: readonly TextState[],
  rasterFailed: boolean,
): Protection {
  if (!surface || !validRgb(surface) || !states.length || !states.every(validState))
    return { alpha: 1, verified: false };
  if (!rasterFailed) {
    for (let step = 0; step < 1000; step++) {
      const alpha = step / 1000;
      if (minimumContrast(envelope.over(surface, alpha), states) >= 4.6) return { alpha, verified: true };
    }
  }
  if (minimumContrast(envelope.over(surface, 1), states) < 4.5) reject('$', 'text_protection_failed');
  return { alpha: 1, verified: true };
}

function validState(state: TextState): boolean {
  return [state.text, ...state.overlays].every(
    (c) => validRgb(c.rgb) && Number.isFinite(c.alpha) && c.alpha >= 0 && c.alpha <= 1,
  );
}

function minimumContrast(envelope: ColorEnvelope, states: readonly TextState[]): number {
  return Math.min(
    ...states.map((state) => {
      const background = state.overlays.reduce((box, c) => box.over(c.rgb, c.alpha), envelope);
      const bg = background.luminanceRange();
      const fg = background.over(state.text.rgb, state.text.alpha).luminanceRange();
      if (fg[0] > bg[1]) return (fg[0] + 0.05) / (bg[1] + 0.05);
      if (bg[0] > fg[1]) return (bg[0] + 0.05) / (fg[1] + 0.05);
      return 1;
    }),
  );
}
