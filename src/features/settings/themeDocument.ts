import type { ThemeStyle } from '@/shared/theme/candidate';
import { themeTokens } from '@/shared/theme/themeTokens';
import type { ResolvedAppearance } from '@/shared/theme/types';

const owned = new WeakMap<HTMLElement, string[]>();
export function paintTheme(root: HTMLElement | undefined, appearance: ResolvedAppearance, style?: ThemeStyle) {
  if (!root) return;
  for (const key of owned.get(root) ?? []) root.style.removeProperty('--' + key);
  owned.delete(root);
  root.toggleAttribute('data-custom-theme', !!style);
  if (!style) return;
  const tokens = themeTokens(style, appearance.scheme, appearance.accentOverride);
  for (const [key, value] of Object.entries(tokens)) root.style.setProperty('--' + key, value);
  owned.set(root, Object.keys(tokens));
}
