// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ThemeBackdrop } from './ThemeBackdrop';

let query: EventTarget & { matches: boolean };
let visibility: DocumentVisibilityState;
beforeEach(() => {
  query = Object.assign(new EventTarget(), { matches: false });
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => query),
  );
  visibility = 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('rejects missing and non-library backgrounds', () => {
  const { container, rerender } = render(<ThemeBackdrop background={{ kind: 'none' }} motion="system" />);
  expect(container.childElementCount).toBe(0);
  rerender(<ThemeBackdrop background={{ kind: 'image', assetId: 'dawn' }} motion="system" />);
  expect(container.querySelectorAll('button,input,a,[tabindex]')).toHaveLength(0);
  expect(container.childElementCount).toBe(0);
  rerender(<ThemeBackdrop background={{ kind: 'image', assetId: 'https://example.com/a.svg' }} motion="system" />);
  expect(container.childElementCount).toBe(0);
});
