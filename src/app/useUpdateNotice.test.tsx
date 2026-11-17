// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { checkForUpdate, UpdateButton, UpdateSection } from '@/features/update';
import { invoke } from '@/shared/api';
import { notifyInfo } from '@/shared/ui';
import { useUpdateNotice } from './useUpdateNotice';

const preference = vi.hoisted(() => ({ enabled: true }));
vi.mock('@/shared/api', () => ({ invoke: vi.fn() }));
vi.mock('@/features/settings', () => ({ openSettings: vi.fn() }));
vi.mock('@/features/update', async (original) => ({
  ...(await original<object>()),
  useAutoCheckEnabled: () => preference.enabled,
}));
vi.mock('@/shared/ui', async (original) => ({ ...(await original<object>()), notifyInfo: vi.fn() }));

const current = { currentVersion: '0.1.15', latest: null };
const available = { currentVersion: '0.1.15', latest: { version: '0.1.16', notes: '' } };
function Discovery() {
  useUpdateNotice();
  return <UpdateButton />;
}
const flush = () =>
  act(async () => {
    await Promise.resolve();
  });
const button = () => screen.queryByRole('button', { name: '更新して再起動' });

beforeEach(async () => {
  vi.resetAllMocks();
  preference.enabled = true;
  vi.mocked(invoke).mockResolvedValue(current);
  await checkForUpdate();
  vi.clearAllMocks();
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it('shows the sidebar button when a newer release exists at startup', async () => {
  vi.mocked(invoke).mockResolvedValue(available);
  render(<Discovery />);
  await flush();
  expect(button()).not.toBeNull();
  expect(button()).toHaveProperty('disabled', false);
});

it('discovers a release published while the app remains open within five minutes', async () => {
  render(<Discovery />);
  await flush();
  expect(button()).toBeNull();
  vi.mocked(invoke).mockResolvedValue(available);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
  });
  expect(button()).not.toBeNull();
});

it.each(['focus', 'online', 'interval'])('recovers after a failed startup check on %s', async (event) => {
  vi.mocked(invoke).mockRejectedValueOnce(new Error('offline'));
  render(<Discovery />);
  await flush();
  expect(button()).toBeNull();
  vi.mocked(invoke).mockResolvedValue(available);
  if (event === 'interval') {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });
  } else fireEvent(window, new Event(event));
  await flush();
  expect(button()).not.toBeNull();
  expect(button()).toHaveProperty('disabled', false);
});

it('rechecks when the document becomes visible', async () => {
  render(<Discovery />);
  await flush();
  vi.mocked(invoke).mockResolvedValue(available);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  fireEvent(document, new Event('visibilitychange'));
  await flush();
  expect(button()).toBeNull();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  fireEvent(document, new Event('visibilitychange'));
  await flush();
  expect(button()).not.toBeNull();
});

it('rechecks on entering settings even when an older result is known', async () => {
  vi.mocked(invoke).mockResolvedValue(available);
  render(<UpdateSection />);
  await flush();
  expect(screen.queryByText('新しい版 0.1.16 があります（いまは 0.1.15）')).not.toBeNull();
});

it('lets a manual check recover from failure and reveal the sidebar button', async () => {
  vi.mocked(invoke).mockRejectedValueOnce(new Error('offline'));
  render(
    <>
      <UpdateSection />
      <UpdateButton />
    </>,
  );
  await flush();
  expect(button()).toBeNull();
  expect(screen.queryByText('offline')).not.toBeNull();
  vi.mocked(invoke).mockResolvedValue(available);
  fireEvent.click(screen.getByRole('button', { name: '更新を確認' }));
  await flush();
  expect(screen.queryAllByRole('button', { name: '更新して再起動' })).toHaveLength(2);
  expect(screen.queryByText('offline')).toBeNull();
});

it('honors auto-check off and removes all triggers on unmount', async () => {
  preference.enabled = false;
  const view = render(<Discovery />);
  fireEvent(window, new Event('online'));
  fireEvent(window, new Event('focus'));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
  });
  expect(invoke).not.toHaveBeenCalled();
  preference.enabled = true;
  view.rerender(<Discovery />);
  await flush();
  expect(invoke).toHaveBeenCalledTimes(1);
  view.unmount();
  fireEvent(window, new Event('online'));
  fireEvent(window, new Event('focus'));
  fireEvent(document, new Event('visibilitychange'));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
  });
  expect(invoke).toHaveBeenCalledTimes(1);
});

it('keeps a known update visible on failure, coalesces concurrent checks and notifies once', async () => {
  vi.mocked(invoke).mockResolvedValue(available);
  render(<Discovery />);
  await flush();
  let rejectCheck!: (error: Error) => void;
  vi.mocked(invoke).mockImplementationOnce(
    () =>
      new Promise((_, reject) => {
        rejectCheck = reject;
      }),
  );
  fireEvent(window, new Event('focus'));
  fireEvent(window, new Event('online'));
  expect(invoke).toHaveBeenCalledTimes(2);
  await act(async () => {
    rejectCheck(new Error('offline'));
    await Promise.resolve();
  });
  expect(button()).not.toBeNull();
  expect(button()).toHaveProperty('disabled', false);
  expect(notifyInfo).toHaveBeenCalledTimes(1);
});
