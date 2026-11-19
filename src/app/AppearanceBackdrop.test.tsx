// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { AppearancePreference, BackgroundSpec, ThemeRegistry } from '@/shared/theme/types';
import { defaultAppearance, themeRegistry } from '@/shared/theme/registry';
import { AppearanceBackdrop } from './AppearanceBackdrop';

const state = vi.hoisted((): { background: BackgroundSpec | null; url: string | null; registry: ThemeRegistry } => ({
  background: { kind: 'none' },
  url: null,
  registry: {},
}));
vi.mock('@/features/settings', () => ({
  useBackgroundImage: () => state.url,
  useAppearanceStore: <T,>(select: (s: { preference: AppearancePreference; registry: ThemeRegistry }) => T) =>
    select({
      preference: { ...defaultAppearance(), schemePreference: 'system', backgroundOverride: state.background },
      registry: state.registry,
    }),
}));
const originalTheme = document.documentElement.dataset.theme;
beforeEach(() => {
  state.registry = themeRegistry;
  state.background = { kind: 'none' };
  state.url = null;
  document.documentElement.dataset.theme = 'dark';
});
afterEach(() => {
  cleanup();
  if (originalTheme === undefined) delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = originalTheme;
});

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

it('follows the system scheme for an inherited background', async () => {
  const image = { kind: 'image' as const, assetId: '12345678-1234-1234-1234-123456789abc' };
  state.registry = {
    guild: {
      ...themeRegistry.guild!,
      variants: {
        light: { background: image },
        dark: { background: { kind: 'none' } },
      },
    },
  };
  state.background = null;
  state.url = 'data:image/png;base64,cGl4ZWw=';
  const { container } = render(<AppearanceBackdrop />);
  expect(container.childElementCount).toBe(0);
  await act(async () => {
    document.documentElement.dataset.theme = 'light';
    await Promise.resolve();
  });
  expect(container.firstElementChild?.getAttribute('data-asset')).toBe(image.assetId);
  await act(async () => {
    document.documentElement.dataset.theme = 'dark';
    await Promise.resolve();
  });
  expect(container.childElementCount).toBe(0);
});
