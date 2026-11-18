import type { Palette, ThemeStyle } from './candidate';
import { FOCUS_MIN, GLASS_TEXT_MIN, glassBounds, glassInk } from './glassTheme';
import type { AccentId, Scheme } from './types';
import { buttonInk, mix } from './themeColors';

const accents: Record<AccentId, [string, string]> = {
  vermilion: ['#ff8f6b', '#902d0c'],
  sakura: ['#f59ec4', '#90134e'],
  green: ['#8fd68a', '#225918'],
  sky: ['#82b9ff', '#16487d'],
  violet: ['#b9a3ff', '#52299c'],
  silver: ['#c8cdd6', '#424854'],
};
const roles: Record<string, [string, string]> = {
  danger: ['#ff9da0', '#a01e2b'],
  warning: ['#fcae6e', '#863e08'],
  success: ['#80e899', '#1a5f30'],
  'kind-ideator': ['#cbe97b', '#455a08'],
  'kind-worker': ['#7ce8c6', '#115d4b'],
  'kind-manager': ['#aabdff', '#414b9d'],
  'kind-expert': ['#ccb3fb', '#643f98'],
  'kind-human': ['#f4c875', '#774801'],
  autonomous: ['#f3d268', '#6b4e03'],
};
export function paletteTokens(p: Palette, scheme: Scheme, override: AccentId | null) {
  const idx = scheme === 'dark' ? 0 : 1;
  const accent = override ? accents[override][idx] : p.accent;
  const face = (weight: number) => mix(p.surface, p.text, weight);
  const fills: Record<string, string> = {
    'bg-app': p.surface,
    'bg-sidebar': face(0.01),
    'bg-panel': face(0.02),
    'bg-input': face(0.025),
    'bg-elevated': face(0.035),
    'bg-sunken': mix(p.surface, idx === 0 ? '#000000' : '#ffffff', 0.12),
    'bg-hover': face(0.045),
    'bg-active': face(0.06),
    'accent-soft': mix(p.surface, accent, 0.06),
    'selection-bg': mix(p.surface, accent, 0.1),
    'mention-self-bg': face(0.03),
  };
  const inks: Record<string, string> = {
    'text-primary': p.text,
    'text-secondary': mix(p.text, p.muted, 0.5),
    'text-muted': p.muted,
    'text-link': p.text,
    'accent-text': accent,
  };
  for (const [role, pair] of Object.entries(roles)) {
    inks[role] = pair[idx];
    fills[role + '-soft'] = mix(p.surface, pair[idx], 0.05);
  }
  const hoverInk = idx === 0 ? '#ffffff' : '#000000';
  const hover = mix(accent, hoverInk, 0.1);
  const controls: Record<string, string> = {
    accent,
    'accent-hover': hover,
    'text-on-accent': buttonInk(accent),
    'danger-hover': mix(inks.danger!, hoverInk, 0.1),
    'text-on-danger': buttonInk(inks.danger!),
    'focus-color': accent,
    'border-focus': accent,
    'accent-swatch-default': p.accent,
    // Blur-only filters keep the painted backdrop within the checked RGB envelope.
    'glass-pane-filter': 'blur(18px)',
    'glass-card-filter': 'blur(12px)',
  };
  const veil = glassBounds(scheme);
  const glassInks = Object.fromEntries(
    Object.entries(inks).map(([key, ink]) => [key, glassInk(ink, scheme, veil, GLASS_TEXT_MIN)]),
  );
  const glassFocus = glassInk(controls['focus-color']!, scheme, veil, FOCUS_MIN);
  const tokens: Record<string, string> = { ...fills, ...inks, ...controls, 'glass-focus-color': glassFocus };
  for (const [key, ink] of Object.entries(glassInks)) tokens['glass-' + key] = ink;
  for (const [syntax, key] of Object.entries({
    comment: 'text-muted',
    keyword: 'kind-manager',
    number: 'kind-human',
    string: 'kind-ideator',
    title: 'kind-worker',
    type: 'kind-expert',
  }))
    tokens['glass-syntax-' + syntax] = glassInks[key]!;
  // The pane CSS recomputes state surfaces from these source tokens on descendants.
  for (const [key, color] of Object.entries(fills)) {
    if (!key.endsWith('-soft') && key !== 'mention-self-bg' && key !== 'selection-bg') continue;
    tokens['raw-' + key] = color;
    tokens['raw-' + key + '-ink'] = color;
    tokens['raw-' + key + '-weight'] = '100%';
  }
  return { tokens, fills, inks, controls, glassInks, glassFocus, veil };
}
export function themeTokens(style: ThemeStyle, scheme: Scheme, accent: AccentId | null) {
  const palette = style.variants[scheme];
  const { tokens } = paletteTokens(palette, scheme, accent);
  if (palette.divider) Object.assign(tokens, dividerTokens(palette.divider));
  const radii = { square: [0, 2, 3, 4], standard: [4, 8, 12, 16], soft: [6, 12, 16, 22] }[style.corners];
  ['sm', 'md', 'lg', 'xl'].forEach((size, i) => {
    tokens['radius-' + size] = radii[i] + 'px';
  });
  tokens['font-heading'] =
    style.typeStyle === 'system'
      ? 'var(--font-sans)'
      : "'Yu Mincho', 'Hiragino Mincho ProN', 'Noto Serif CJK JP', Georgia, serif";
  return tokens;
}

function dividerTokens({ color, style, width }: NonNullable<Palette['divider']>) {
  return {
    'border-subtle': `color-mix(in srgb, ${color} 65%, transparent)`,
    'border-strong': `color-mix(in srgb, ${color} 85%, transparent)`,
    'border-hover': color,
    'glass-edge': `color-mix(in srgb, ${color} 65%, transparent)`,
    'area-divider-width': style === 'none' ? 'var(--hidden-divider-width, 0px)' : width + 'px',
    'area-divider-style': style === 'none' ? 'var(--hidden-divider-style, none)' : style,
    'area-divider-glass-color': 'var(--glass-edge)',
    'area-divider-glass-shadow': 'none',
  };
}
