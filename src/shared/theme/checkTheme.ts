import { ColorEnvelope } from '../lib/themeBackdrop/envelope';
import type { ThemeStyle } from './candidate';
import { rgb, solid, worstRatio } from './themeColors';
import { paletteTokens } from './themeTokens';
import type { AccentId, Scheme } from './types';

export interface ContrastIssue {
  scheme: Scheme;
  foreground: string;
  background: string;
  ratio: number;
  required: number;
}

export function checkTheme(style: ThemeStyle, accent: AccentId | null = null): ContrastIssue[] {
  const failures: ContrastIssue[] = [];
  for (const scheme of ['dark', 'light'] as const) {
    const { fills, inks, controls } = paletteTokens(style.variants[scheme], scheme, accent);
    const check = (foreground: string, ink: string, background: string, box: ColorEnvelope, required: number) => {
      const ratio = worstRatio(ink, box);
      if (!(ratio >= required)) failures.push({ scheme, foreground, background, ratio, required });
    };
    const surfaces: [string, ColorEnvelope, number][] = Object.entries(fills).map(([key, color]) => [
      key,
      solid(color),
      4.5,
    ]);
    const veil = ColorEnvelope.fullRgb()
      .over(rgb(controls['glass-veil-color']!), parseFloat(controls['glass-veil-weight']!) / 100)
      .roundedOut();
    surfaces.push(['glass', veil, 4.6]);
    for (const [surface, box, min] of surfaces) {
      for (const [name, ink] of Object.entries(inks)) check(name, ink, surface, box, min);
      check('focus-color', controls['focus-color']!, surface, box, 3);
    }
    // The focus ring is separated from the control by a two-pixel bg-app band.
    for (const [fill, ink, minimum] of [
      ['accent', 'text-on-accent', 7],
      ['accent-hover', 'text-on-accent', 6.5],
      ['danger', 'text-on-danger', 4.5],
      ['danger-hover', 'text-on-danger', 4.5],
    ] as const)
      check(ink, controls[ink]!, fill, solid(controls[fill] ?? inks[fill]!), minimum);
  }
  return failures.sort((a, b) => a.ratio / a.required - b.ratio / b.required);
}
