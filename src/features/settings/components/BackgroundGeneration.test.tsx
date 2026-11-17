// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { backendInfo } from '@/shared/lib/backends.test-support';
import { settingsApi } from '../api';
import { setBackground } from '../appearance';
import { APPEARANCE_STORAGE_KEY } from '../model/appearance';
import { BackgroundPicker } from './BackgroundPicker';
import { ja } from '../i18n/appearance/ja';

const runtime = vi.hoisted(() => ({ backends: [] as ReturnType<typeof backendInfo>[] }));
vi.mock('@/features/runtime', () => ({ useBackends: () => runtime.backends }));
const id = '12345678-1234-1234-1234-123456789abc';
let resolve: (id: string) => void;
let reject: (error: unknown) => void;
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  runtime.backends = [backendInfo({ id: 'artist', label: 'Artist', backgroundGeneration: true })];
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  setBackground({ kind: 'none' });
  vi.spyOn(settingsApi, 'listBackgrounds').mockResolvedValue([]);
  vi.spyOn(settingsApi, 'getBackground').mockResolvedValue('data:image/png;base64,cGl4ZWw=');
  vi.spyOn(settingsApi, 'cancelBackgroundGeneration').mockResolvedValue(null);
  vi.spyOn(settingsApi, 'generateBackground').mockImplementation(
    () =>
      new Promise((yes, no) => {
        resolve = yes;
        reject = no;
      }),
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function open() {
  render(<BackgroundPicker scheme="dark" />);
  fireEvent.click(screen.getByRole('button', { name: ja.backgroundGenerate }));
}
function submit() {
  fireEvent.change(screen.getByLabelText(ja.backgroundSubject), { target: { value: ' quiet lake ' } });
  fireEvent.submit(screen.getByLabelText(ja.backgroundSubject).closest('form')!);
}
it('hides generation without background capability or a ready backend', () => {
  runtime.backends = [backendInfo()];
  const view = render(<BackgroundPicker scheme="light" />);
  expect(screen.queryByRole('button', { name: ja.backgroundGenerate })).toBeNull();
  runtime.backends = [backendInfo({ backgroundGeneration: true, status: 'needs_auth' })];
  view.rerender(<BackgroundPicker scheme="light" />);
  expect(screen.queryByRole('button', { name: ja.backgroundGenerate })).toBeNull();
});
it('selects only ready image backends and validates the subject', () => {
  runtime.backends.push(
    backendInfo({ id: 'second', label: 'Second', backgroundGeneration: true }),
    backendInfo({ id: 'plain' }),
    backendInfo({ id: 'signedout', backgroundGeneration: true, status: 'needs_auth' }),
  );
  open();
  expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Artist', 'Second']);
  fireEvent.change(screen.getByLabelText(ja.backgroundBackend), { target: { value: 'second' } });
  fireEvent.submit(screen.getByLabelText(ja.backgroundSubject).closest('form')!);
  expect(screen.getByText(ja.backgroundSubjectInvalid)).toBeTruthy();
  expect(settingsApi.generateBackground).not.toHaveBeenCalled();
  submit();
  expect(settingsApi.generateBackground).toHaveBeenCalledWith(expect.any(String), 'second', 'quiet lake');
});
it('shows progress, prevents duplicate submissions and selects the saved background', async () => {
  open();
  submit();
  submit();
  expect(screen.getByRole('status').textContent).toBe(ja.backgroundGenerating);
  expect(settingsApi.generateBackground).toHaveBeenCalledTimes(1);
  await act(() => {
    resolve(id);
    return Promise.resolve();
  });
  const image = await screen.findByRole('radio', { name: `${ja.backgroundImage} 1` });
  expect(image.getAttribute('aria-checked')).toBe('true');
  expect(
    (
      JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY)!) as {
        backgroundOverride: { kind: string; assetId?: string };
      }
    ).backgroundOverride,
  ).toEqual({
    kind: 'image',
    assetId: id,
  });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(settingsApi.cancelBackgroundGeneration).not.toHaveBeenCalled();
});
it('shows failure and permits a retry', async () => {
  open();
  submit();
  await act(() => {
    reject(new Error('failed'));
    return Promise.resolve();
  });
  expect(screen.getByRole('alert').textContent).toBe(ja.backgroundGenerationFailed);
  submit();
  expect(settingsApi.generateBackground).toHaveBeenCalledTimes(2);
});
it('cancels and ignores a late success', async () => {
  open();
  submit();
  fireEvent.click(screen.getByRole('button', { name: ja.backgroundStop }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(settingsApi.cancelBackgroundGeneration).toHaveBeenCalledTimes(1);
  await act(() => {
    resolve(id);
    return Promise.resolve();
  });
  expect(
    (
      JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY)!) as {
        backgroundOverride: { kind: string; assetId?: string };
      }
    ).backgroundOverride?.kind,
  ).not.toBe('image');
});
it('keeps the dialog open and reports a failed cancellation', async () => {
  vi.mocked(settingsApi.cancelBackgroundGeneration).mockRejectedValue(new Error('failed'));
  open();
  submit();
  fireEvent.click(screen.getByRole('button', { name: ja.backgroundStop }));
  expect((await screen.findByRole('alert')).textContent).toBe(ja.backgroundCancelFailed);
  expect(screen.getByRole('dialog')).toBeTruthy();
  await act(() => {
    reject(new Error('failed'));
    return Promise.resolve();
  });
});
it('cancels on unmount without applying a late result', async () => {
  const view = render(<BackgroundPicker scheme="light" />);
  fireEvent.click(screen.getByRole('button', { name: ja.backgroundGenerate }));
  submit();
  view.unmount();
  expect(settingsApi.cancelBackgroundGeneration).toHaveBeenCalledTimes(1);
  await act(() => {
    resolve(id);
    return Promise.resolve();
  });
  expect(
    (
      JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY)!) as {
        backgroundOverride: { kind: string; assetId?: string };
      }
    ).backgroundOverride?.kind,
  ).not.toBe('image');
});
