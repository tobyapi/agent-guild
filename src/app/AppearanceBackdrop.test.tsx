// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { defaultAppearance } from '@/shared/theme/registry';
import { AppearanceBackdrop } from './AppearanceBackdrop';

vi.mock('@/features/settings', () => ({
  useAppearanceStore: () => ({
    ...defaultAppearance(),
    schemePreference: 'system',
    backgroundOverride: { kind: 'generated', presetId: 'tile-turtle' },
  }),
}));
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('renders one static backdrop, follows system scheme changes and redraws at window size', async () => {
  document.documentElement.dataset.theme = 'dark';
  const { container } = render(<AppearanceBackdrop />);
  const svg = () => container.querySelector('svg')!;
  expect(container.querySelectorAll('[data-generated]')).toHaveLength(1);
  expect(container.firstElementChild?.getAttribute('data-running')).toBe('false');
  expect(svg().getAttribute('width')).toBe(String(window.innerWidth));
  expect(svg().querySelector('rect[fill]')?.getAttribute('fill')).toBe('#101D32');
  await act(async () => {
    document.documentElement.dataset.theme = 'light';
    await Promise.resolve();
    vi.advanceTimersToNextFrame();
  });
  expect(svg().querySelector('rect[fill]')?.getAttribute('fill')).toBe('#E8F1EC');
  const oldWidth = window.innerWidth;
  const oldHeight = window.innerHeight;
  act(() => {
    window.innerWidth = 1200;
    window.innerHeight = 800;
    window.dispatchEvent(new Event('resize'));
    vi.advanceTimersToNextFrame();
  });
  expect(svg().getAttribute('width')).toBe('1200');
  expect(svg().getAttribute('height')).toBe('800');
  expect(svg().querySelectorAll('animate, animateTransform')).toHaveLength(0);
  window.innerWidth = oldWidth;
  window.innerHeight = oldHeight;
});
