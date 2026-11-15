// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
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

it('renders only bundled backgrounds, with no interactive decoration', () => {
  const { container, rerender } = render(<ThemeBackdrop background={{ kind: 'none' }} motion="system" />);
  expect(container.childElementCount).toBe(0);
  rerender(<ThemeBackdrop background={{ kind: 'image', assetId: 'dawn' }} motion="system" />);
  expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
  expect(container.querySelectorAll('button,input,a,[tabindex]')).toHaveLength(0);
  expect(container.firstElementChild?.getAttribute('data-asset')).toBe('dawn');
  rerender(<ThemeBackdrop background={{ kind: 'image', assetId: 'https://example.com/a.svg' }} motion="system" />);
  expect(container.childElementCount).toBe(0);
  rerender(<ThemeBackdrop background={{ kind: 'scene', sceneId: 'missing' }} motion="system" />);
  expect(container.childElementCount).toBe(0);
});

it('combines all stop conditions and never resumes while another remains', () => {
  const background = { kind: 'scene', sceneId: 'aurora' } as const;
  const { container, rerender } = render(<ThemeBackdrop background={background} motion="system" />);
  const running = () => container.firstElementChild?.getAttribute('data-running');
  expect(running()).toBe('true');
  act(() => {
    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(running()).toBe('false');
  act(() => {
    query.matches = true;
    query.dispatchEvent(new Event('change'));
  });
  act(() => {
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(running()).toBe('false');
  rerender(<ThemeBackdrop background={background} motion="off" />);
  act(() => {
    query.matches = false;
    query.dispatchEvent(new Event('change'));
  });
  expect(running()).toBe('false');
  rerender(<ThemeBackdrop background={background} motion="system" />);
  expect(running()).toBe('true');
  act(() => {
    query.matches = true;
    query.dispatchEvent(new Event('change'));
  });
  expect(running()).toBe('false');
  act(() => {
    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
  });
  act(() => {
    query.matches = false;
    query.dispatchEvent(new Event('change'));
  });
  expect(running()).toBe('false');
  act(() => {
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(running()).toBe('true');
});

it('starts paused when reduced motion or a hidden document is already active, and cleans listeners', () => {
  query.matches = true;
  visibility = 'hidden';
  const removeQuery = vi.spyOn(query, 'removeEventListener');
  const removeDocument = vi.spyOn(document, 'removeEventListener');
  const { container, unmount } = render(
    <ThemeBackdrop background={{ kind: 'scene', sceneId: 'aurora' }} motion="system" />,
  );
  expect(container.firstElementChild?.getAttribute('data-running')).toBe('false');
  unmount();
  expect(removeQuery).toHaveBeenCalledWith('change', expect.any(Function));
  expect(removeDocument).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
});
