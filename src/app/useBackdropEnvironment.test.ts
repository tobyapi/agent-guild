// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useBackdropEnvironment } from './useBackdropEnvironment';

let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
const originalWidth = window.innerWidth;
const originalHeight = window.innerHeight;
const originalTheme = document.documentElement.dataset.theme;

beforeEach(() => {
  frames = new Map();
  nextFrame = 0;
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    }),
  );
  vi.stubGlobal(
    'cancelAnimationFrame',
    vi.fn((id: number) => frames.delete(id)),
  );
  document.documentElement.dataset.theme = 'dark';
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.innerWidth = originalWidth;
  window.innerHeight = originalHeight;
  if (originalTheme === undefined) delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = originalTheme;
});

function flushFrame() {
  const pending = [...frames.values()];
  frames.clear();
  act(() => pending.forEach((callback) => callback(16)));
}

it('coalesces resize bursts into one render per frame using the latest dimensions', () => {
  const rendered = vi.fn();
  const { result } = renderHook(() => {
    rendered();
    return useBackdropEnvironment();
  });
  rendered.mockClear();
  act(() => {
    for (const width of [1100, 1200, 1300]) {
      window.innerWidth = width;
      window.innerHeight = 800;
      window.dispatchEvent(new Event('resize'));
    }
  });
  expect(rendered).not.toHaveBeenCalled();
  expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
  expect(frames.size).toBe(1);
  flushFrame();
  expect(rendered).toHaveBeenCalledTimes(1);
  expect(result.current.viewport).toEqual([1300, 800]);
  act(() => {
    window.innerWidth = 1400;
    window.dispatchEvent(new Event('resize'));
  });
  flushFrame();
  expect(rendered).toHaveBeenCalledTimes(2);
  expect(result.current.viewport).toEqual([1400, 800]);
});

it('coalesces theme mutations with resize and follows later theme changes', async () => {
  const rendered = vi.fn();
  const { result } = renderHook(() => {
    rendered();
    return useBackdropEnvironment();
  });
  rendered.mockClear();
  await act(async () => {
    document.documentElement.dataset.theme = 'light';
    window.innerWidth = 1200;
    window.dispatchEvent(new Event('resize'));
    await Promise.resolve();
  });
  expect(result.current.scheme).toBe('dark');
  expect(rendered).not.toHaveBeenCalled();
  expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
  flushFrame();
  expect(rendered).toHaveBeenCalledTimes(1);
  expect(result.current).toEqual({ scheme: 'light', viewport: [1200, originalHeight] });
  await act(async () => {
    document.documentElement.dataset.theme = 'dark';
    await Promise.resolve();
  });
  flushFrame();
  expect(result.current.scheme).toBe('dark');
  expect(rendered).toHaveBeenCalledTimes(2);
});

it('cancels the pending frame and stops observing after unmount', async () => {
  const rendered = vi.fn();
  const { unmount } = renderHook(() => {
    rendered();
    return useBackdropEnvironment();
  });
  act(() => {
    window.dispatchEvent(new Event('resize'));
  });
  expect(frames.size).toBe(1);
  unmount();
  rendered.mockClear();
  expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
  expect(frames.size).toBe(0);
  await act(async () => {
    window.dispatchEvent(new Event('resize'));
    document.documentElement.dataset.theme = 'light';
    await Promise.resolve();
  });
  flushFrame();
  expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
  expect(rendered).not.toHaveBeenCalled();
});
