// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { defaultAppearance, themeRegistry } from '@/shared/theme/registry';
import { APPEARANCE_STORAGE_KEY, parseAppearance } from '../model/appearance';
import { settingsApi } from '../api';
import { initAppearance, setBackground, useAppearanceStore } from '../appearance';
import { readBackground } from '../model/readBackground';
import { useBackgroundImage } from '../useBackgroundImage';
import { BackgroundPicker } from './BackgroundPicker';
import { en } from '../i18n/appearance/en';
import { ja } from '../i18n/appearance/ja';
import { ko } from '../i18n/appearance/ko';
import { zhHans } from '../i18n/appearance/zhHans';
import { zhHant } from '../i18n/appearance/zhHant';

const id = '12345678-1234-1234-1234-123456789abc';
let stop: () => void;
const preference = {
  ...defaultAppearance(),
  schemePreference: 'light',
  accentOverride: 'sky',
  motionPreference: 'off',
  backgroundOverride: { kind: 'image', assetId: id },
};
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(preference));
  vi.spyOn(settingsApi, 'listBackgrounds').mockResolvedValue([id]);
  vi.spyOn(settingsApi, 'getBackground').mockResolvedValue('data:image/png;base64,cGl4ZWw=');
  vi.spyOn(settingsApi, 'importBackground').mockResolvedValue(id);
  vi.spyOn(settingsApi, 'deleteBackground').mockResolvedValue(null);
  stop = initAppearance();
});
afterEach(() => {
  cleanup();
  stop();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('lists, selects, confirms deletion and preserves all other settings', async () => {
  render(<BackgroundPicker scheme="light" />);
  const image = await screen.findByRole('radio', { name: `${ja.backgroundImage} 1` });
  expect(image.getAttribute('aria-checked')).toBe('true');
  expect(document.documentElement.dataset.glass).toBe('frosted');
  fireEvent.click(screen.getByRole('radio', { name: ja.backgroundNone }));
  expect(document.documentElement.dataset.glass).toBe('none');
  fireEvent.keyDown(screen.getByRole('radio', { name: ja.backgroundNone }), { key: 'ArrowRight' });
  expect(image.getAttribute('aria-checked')).toBe('true');
  expect(document.documentElement.dataset.glass).toBe('frosted');
  fireEvent.click(screen.getByRole('button', { name: `${ja.backgroundDelete} 1` }));
  expect(settingsApi.deleteBackground).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: ja.backgroundDelete }));
  await waitFor(() => expect(screen.queryByRole('radio', { name: `${ja.backgroundImage} 1` })).toBeNull());
  expect(JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY)!)).toEqual({
    ...preference,
    backgroundOverride: { kind: 'none' },
  });
  expect(document.documentElement.dataset.glass).toBe('none');
});

it('imports raw base64, selects the image and persists only its ID', async () => {
  vi.mocked(settingsApi.listBackgrounds).mockResolvedValue([]);
  render(<BackgroundPicker scheme="light" />);
  fireEvent.change(screen.getByLabelText(ja.backgroundAdd), {
    target: { files: [new File(['pixel'], 'a.png', { type: 'image/png' })] },
  });
  await waitFor(() => expect(settingsApi.importBackground).toHaveBeenCalledWith('cGl4ZWw='));
  expect(await screen.findByRole('radio', { name: `${ja.backgroundImage} 1` })).toBeTruthy();
  expect(JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY)!)).toEqual(preference);
});

it('reports unsupported, oversized and broken images', async () => {
  await expect(readBackground(new File(['x'], 'a.gif', { type: 'image/gif' }))).rejects.toMatchObject({
    reason: 'backgroundFormat',
  });
  await expect(
    readBackground(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'a.png', { type: 'image/png' })),
  ).rejects.toMatchObject({ reason: 'backgroundTooLarge' });
  vi.mocked(settingsApi.importBackground).mockRejectedValue({ code: 'validation' });
  render(<BackgroundPicker scheme="light" />);
  fireEvent.change(screen.getByLabelText(ja.backgroundAdd), {
    target: { files: [new File(['bad'], 'a.png', { type: 'image/png' })] },
  });
  expect((await screen.findByRole('alert')).textContent).toBe(ja.backgroundBroken);
});

it('shows unavailable when the browser mock rejects importing', async () => {
  vi.mocked(settingsApi.importBackground).mockRejectedValue({ code: 'unavailable' });
  render(<BackgroundPicker scheme="light" />);
  fireEvent.change(screen.getByLabelText(ja.backgroundAdd), {
    target: { files: [new File(['x'], 'a.webp', { type: 'image/webp' })] },
  });
  expect((await screen.findByRole('alert')).textContent).toBe(ja.backgroundUnavailable);
});

function BackdropProbe() {
  const background = useAppearanceStore((s) => s.preference.backgroundOverride);
  const url = useBackgroundImage(background?.kind === 'image' ? background.assetId : null);
  return <div data-testid="probe">{url}</div>;
}

it('falls back to none on startup read failure, retaining brightness and other preferences', async () => {
  vi.mocked(settingsApi.getBackground).mockRejectedValue({ code: 'not_found' });
  render(<BackdropProbe />);
  await waitFor(() =>
    expect(JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY)!)).toMatchObject({
      backgroundOverride: { kind: 'none' },
    }),
  );
  expect(JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY)!)).toEqual({
    ...preference,
    backgroundOverride: { kind: 'none' },
  });
});

it('shares reads and does not refetch when unrelated preferences rerender', async () => {
  const view = render(
    <>
      <BackdropProbe />
      <BackdropProbe />
    </>,
  );
  await waitFor(() => expect(settingsApi.getBackground).toHaveBeenCalledTimes(1));
  view.rerender(
    <>
      <BackdropProbe />
      <BackdropProbe />
    </>,
  );
  expect(settingsApi.getBackground).toHaveBeenCalledTimes(1);
  act(() => setBackground({ kind: 'none' }));
  act(() => setBackground({ kind: 'image', assetId: id }));
  await waitFor(() => expect(settingsApi.getBackground).toHaveBeenCalledTimes(2));
});

it('reads existing v2 settings and rejects paths/URLs while preserving the scheme', () => {
  expect(parseAppearance(JSON.stringify(preference), themeRegistry)).toEqual(preference);
  for (const assetId of ['dawn', 'night', 'aurora', 'turtle', 'https://example.com/a.png', '../file']) {
    expect(
      parseAppearance(JSON.stringify({ ...preference, backgroundOverride: { kind: 'image', assetId } }), themeRegistry),
    ).toEqual({ ...preference, backgroundOverride: { kind: 'none' } });
  }
});

it('provides every image action and error in all five languages', () => {
  for (const table of [en, ja, ko, zhHans, zhHant]) {
    for (const key of [
      'backgroundAdd',
      'backgroundDelete',
      'backgroundDeleteConfirm',
      'backgroundTooLarge',
      'backgroundFormat',
      'backgroundBroken',
      'backgroundUnavailable',
    ] as const) {
      expect(table[key].length).toBeGreaterThan(1);
      expect(table[key]).not.toContain('???');
    }
  }
});

it('deleting an unselected image preserves the current background', async () => {
  const other = 'abcdefab-1234-1234-1234-123456789abc';
  vi.mocked(settingsApi.listBackgrounds).mockResolvedValue([id, other]);
  render(<BackgroundPicker scheme="light" />);
  fireEvent.click(await screen.findByRole('button', { name: `${ja.backgroundDelete} 2` }));
  fireEvent.click(screen.getByRole('button', { name: ja.backgroundDelete }));
  await waitFor(() => expect(settingsApi.deleteBackground).toHaveBeenCalledWith(other));
  expect(JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY)!)).toEqual(preference);
});
