import type { ColorEnvelope } from '../lib/themeBackdrop/envelope';
import type { ThemeStyle } from './candidate';
import { solid, worstRatio } from './themeColors';
import { FOCUS_MIN, GLASS_TEXT_MIN } from './glassTheme';
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
    const { fills, inks, controls, veil, glassInks, glassFocus } = paletteTokens(
      style.variants[scheme],
      scheme,
      accent,
    );
    const check = (foreground: string, ink: string, background: string, box: ColorEnvelope, required: number) => {
      const ratio = worstRatio(ink, box);
      if (!(ratio >= required)) failures.push({ scheme, foreground, background, ratio, required });
    };
    for (const [surface, color] of Object.entries(fills)) {
      const box = solid(color);
      for (const [name, ink] of Object.entries(inks)) check(name, ink, surface, box, 4.5);
      // A child with an opaque background can inherit the pane’s body color.
      check('glass-text-primary', glassInks['text-primary']!, surface, box, 4.5);
      check('focus-color', controls['focus-color']!, surface, box, FOCUS_MIN);
    }
    for (const [name, ink] of Object.entries(glassInks)) check(name, ink, 'glass', veil, GLASS_TEXT_MIN);
    check('glass-focus-color', glassFocus, 'glass', veil, FOCUS_MIN);
    check('glass-focus-color', glassFocus, 'bg-app', solid(fills['bg-app']!), FOCUS_MIN);
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
