// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { AppearancePreference, BackgroundSpec, ThemeRegistry } from '@/shared/theme/types';
import { defaultAppearance, themeRegistry } from '@/shared/theme/registry';
import { AppearanceBackdrop } from './AppearanceBackdrop';

const state = vi.hoisted((): { background: BackgroundSpec; url: string | null } => ({
  background: { kind: 'none' },
  url: null,
}));
vi.mock('@/features/settings', () => ({
  useBackgroundImage: () => state.url,
  useAppearanceStore: <T,>(select: (s: { preference: AppearancePreference; registry: ThemeRegistry }) => T) =>
    select({ preference: { ...defaultAppearance(), backgroundOverride: state.background }, registry: themeRegistry }),
}));
afterEach(cleanup);

it('renders no background for an empty selection', () => {
  const { container } = render(<AppearanceBackdrop />);
  expect(container.childElementCount).toBe(0);
});

it('renders the loaded library image as a decorative cover background', () => {
  state.background = { kind: 'image', assetId: '12345678-1234-1234-1234-123456789abc' };
  state.url = 'data:image/png;base64,cGl4ZWw=';
  const { container, rerender } = render(<AppearanceBackdrop />);
  const backdrop = container.firstElementChild as HTMLElement;
  expect(backdrop.getAttribute('aria-hidden')).toBe('true');
  expect(backdrop.style.backgroundImage).toContain(state.url);
  state.url = null;
  rerender(<AppearanceBackdrop />);
  expect(container.childElementCount).toBe(0);
});
