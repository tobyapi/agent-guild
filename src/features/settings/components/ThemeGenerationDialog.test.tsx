// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { backendInfo } from '@/shared/lib/backends.test-support';
import { candidate, imageId } from '@/shared/theme/candidate.test-support';
import { settingsApi } from '../api';
import { initAppearance } from '../appearance';
import { LIBRARY_KEY, type ThemeLibrary } from '../themeLibrary';
import { ja } from '../i18n/appearance/ja';
import { ThemeGenerationDialog } from './ThemeGenerationDialog';

vi.mock('@/features/runtime', () => ({
  useBackends: () => [backendInfo({ id: 'painter', themeGeneration: true, backgroundGeneration: true })],
}));
let stop: () => void;
function library() {
  return JSON.parse(localStorage.getItem(LIBRARY_KEY)!) as ThemeLibrary;
}
beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
  });
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  stop = initAppearance();
  vi.spyOn(settingsApi, 'generateTheme').mockResolvedValue(JSON.stringify(candidate));
  vi.spyOn(settingsApi, 'generateBackground').mockResolvedValue(imageId);
  vi.spyOn(settingsApi, 'getBackground').mockResolvedValue('data:image/png;base64,cGl4ZWw=');
  vi.spyOn(settingsApi, 'listBackgrounds').mockResolvedValue([]);
  vi.spyOn(settingsApi, 'cancelBackgroundGeneration').mockResolvedValue(null);
});
afterEach(() => {
  cleanup();
  stop();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function open() {
  const onClose = vi.fn();
  render(<ThemeGenerationDialog onClose={onClose} />);
  fireEvent.change(screen.getByLabelText(ja.backgroundSubject), { target: { value: 'Library' } });
  fireEvent.click(screen.getByRole('button', { name: ja.backgroundGenerate }));
  return onClose;
}
it('isolates the preview document, toggles schemes there and saves without changing the parent', async () => {
  const onClose = open();
  const frame = await screen.findByTitle<HTMLIFrameElement>(ja.previewCompare);
  await waitFor(() => expect(frame.contentDocument?.documentElement.dataset.themeId).toBe('candidate'));
  await waitFor(() =>
    expect(frame.contentDocument?.querySelector('main img')?.getAttribute('src')).toBe(
      'data:image/png;base64,cGl4ZWw=',
    ),
  );
  expect(frame.contentDocument?.documentElement.style.getPropertyValue('--bg-app')).toBe(
    candidate.variants.dark.surface,
  );
  const previewRoot = frame.contentDocument!.documentElement;
  expect(previewRoot.style.getPropertyValue('--area-divider-style')).toBe('dashed');
  expect(previewRoot.style.getPropertyValue('--area-divider-width')).toBe('2px');
  expect(frame.contentDocument?.querySelector('.sample-members')?.textContent).toBe(ja.sampleMembers);
  fireEvent.click(screen.getByRole('radio', { name: ja.themeGuildLight }));
  expect(previewRoot.style.getPropertyValue('--area-divider-style')).toBe('double');
  expect(previewRoot.style.getPropertyValue('--area-divider-width')).toBe('3px');
  fireEvent.click(screen.getByRole('radio', { name: ja.previewCurrent }));
  expect(previewRoot.style.getPropertyValue('--area-divider-style')).toBe('');
  fireEvent.click(screen.getByRole('radio', { name: ja.previewCandidate }));
  expect(frame.contentDocument?.documentElement.style.getPropertyValue('--bg-app')).toBe(
    candidate.variants.light.surface,
  );
  expect(document.documentElement.dataset.themeId).toBe('guild');
  expect(library().themes).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: ja.themeSave }));
  expect(onClose).toHaveBeenCalledOnce();
  expect(library().themes[0]?.backgroundId).toBe(imageId);
  expect(library().themes[0]?.variants).toEqual(candidate.variants);
  expect(library().active.themeId).toBe('guild');
});
it('shows the failed ratio, allows regeneration, and applies only a verified candidate', async () => {
  vi.mocked(settingsApi.generateTheme).mockResolvedValueOnce(
    JSON.stringify({
      ...candidate,
      variants: { ...candidate.variants, dark: { ...candidate.variants.dark, text: '#131316' } },
    }),
  );
  open();
  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toContain(ja.requiredContrast);
  expect(settingsApi.generateBackground).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: ja.saveApply })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: ja.backgroundGenerate }));
  fireEvent.click(await screen.findByRole('button', { name: ja.saveApply }));
  expect(library().active.themeId).toBe(library().themes[0]?.id);
  expect(library().previous?.themeId).toBe('guild');
});
it('keeps a late image out of appearance after cancellation', async () => {
  let finish!: (value: string) => void;
  vi.mocked(settingsApi.generateBackground).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const onClose = open();
  await waitFor(() => expect(settingsApi.generateBackground).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole('button', { name: ja.backgroundStop }));
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  await act(async () => {
    finish(imageId);
    await Promise.resolve();
  });
  expect(settingsApi.cancelBackgroundGeneration).toHaveBeenCalledWith(
    vi.mocked(settingsApi.generateBackground).mock.calls[0]![0],
  );
  expect(library().themes).toHaveLength(0);
  expect(document.documentElement.dataset.themeId).toBe('guild');
});
it('keeps the palette after an image failure and saves without an image on request', async () => {
  vi.mocked(settingsApi.generateBackground).mockRejectedValueOnce(new Error('image failed'));
  open();
  fireEvent.click(await screen.findByRole('button', { name: ja.noImage }));
  fireEvent.click(await screen.findByRole('button', { name: ja.saveApply }));
  expect(library().themes[0]).toMatchObject({ name: candidate.name, backgroundId: null });
});

it('shows a localized format error for a candidate rejected by Rust', async () => {
  vi.mocked(settingsApi.generateTheme).mockRejectedValueOnce({ code: 'validation', field: 'candidate' });
  open();
  expect((await screen.findByRole('alert')).textContent).toContain(ja.invalidTheme);
  expect(settingsApi.generateBackground).not.toHaveBeenCalled();
});
