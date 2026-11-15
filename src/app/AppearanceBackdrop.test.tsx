// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { BackgroundSpec } from '@/shared/theme/types';
import { defaultAppearance } from '@/shared/theme/registry';
import { AppearanceBackdrop } from './AppearanceBackdrop';

const state = vi.hoisted((): { background: BackgroundSpec; url: string | null } => ({
  background: { kind: 'generated', presetId: 'tile-turtle' },
  url: null,
}));
vi.mock('@/features/settings', () => ({
  useBackgroundImage: () => state.url,
  useAppearanceStore: () => ({
    ...defaultAppearance(),
    backgroundOverride: state.background,
  }),
}));
afterEach(cleanup);

it('renders no background for a retired preset', () => {
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
