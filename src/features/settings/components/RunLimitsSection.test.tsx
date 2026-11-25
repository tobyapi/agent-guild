// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DEFAULT_RUN_LIMITS } from '@/shared/types/domain';
import { settingsApi } from '../api';
import { RunLimitsSection } from './RunLimitsSection';

vi.mock('../api', () => ({
  settingsApi: {
    getRunLimits: vi.fn(),
    setRunLimits: vi.fn(),
  },
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it('opens with both limits unlimited and saves the chosen settings together', async () => {
  vi.mocked(settingsApi.getRunLimits).mockResolvedValue(DEFAULT_RUN_LIMITS);
  vi.mocked(settingsApi.setRunLimits).mockResolvedValue(null);
  render(<RunLimitsSection />);
  const timeout = screen.getByRole<HTMLSelectElement>('combobox', { name: '1回の実行の上限時間' });
  const concurrent = screen.getByRole<HTMLSelectElement>('combobox', { name: '同時に動ける数' });
  const save = screen.getByRole<HTMLButtonElement>('button', { name: '実行の上限を保存' });
  await waitFor(() => expect(timeout.disabled).toBe(false));
  expect(timeout.selectedOptions[0]?.textContent).toBe('制限なし');
  expect(concurrent.selectedOptions[0]?.textContent).toBe('制限なし');
  expect(save.disabled).toBe(true);
  fireEvent.change(timeout, { target: { value: '120' } });
  fireEvent.change(concurrent, { target: { value: '3' } });
  fireEvent.click(save);
  await waitFor(() =>
    expect(settingsApi.setRunLimits).toHaveBeenCalledWith({ timeoutMinutes: 120, maxConcurrentJobs: 3 }),
  );
  await waitFor(() => expect(save.disabled).toBe(true));
});

it('keeps a failed edit available for retry', async () => {
  vi.mocked(settingsApi.getRunLimits).mockResolvedValue({ timeoutMinutes: 30, maxConcurrentJobs: 2 });
  vi.mocked(settingsApi.setRunLimits).mockRejectedValueOnce(new Error('storage')).mockResolvedValueOnce(null);
  render(<RunLimitsSection />);
  const timeout = screen.getByRole<HTMLSelectElement>('combobox', { name: '1回の実行の上限時間' });
  const save = screen.getByRole<HTMLButtonElement>('button', { name: '実行の上限を保存' });
  await waitFor(() => expect(timeout.value).toBe('30'));
  fireEvent.change(timeout, { target: { value: '' } });
  fireEvent.click(save);
  await screen.findByRole('alert');
  expect(timeout.value).toBe('');
  expect(save.disabled).toBe(false);
  fireEvent.click(save);
  await waitFor(() =>
    expect(settingsApi.setRunLimits).toHaveBeenLastCalledWith({ timeoutMinutes: null, maxConcurrentJobs: 2 }),
  );
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
});
