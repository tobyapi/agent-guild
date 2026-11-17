// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import backends from '../../../../contracts/runner/api-backends.json';
import type { BackendInfo } from '@/shared/types/domain';
import { BackendsSection } from './BackendsSection';
import { settingsApi } from '../api';

vi.mock('@/features/runtime', async (original) => ({
  ...(await original<typeof import('@/features/runtime')>()),
  useBackends: () => backends as BackendInfo[],
}));
vi.mock('../api', () => ({
  settingsApi: {
    backendAuthModes: vi.fn().mockResolvedValue({}),
    backendApiKey: vi.fn(),
  },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it.each(backends)('$id saves, replaces and deletes its own key through the generic API-only form', async (backend) => {
  vi.mocked(settingsApi.backendApiKey).mockImplementation((_id, action) =>
    Promise.resolve(
      JSON.stringify({
        source: action === 'set' ? 'saved' : 'environment',
        supported: true,
      }),
    ),
  );
  render(<BackendsSection />);
  const field = await screen.findByLabelText<HTMLInputElement>(`${backend.label} の API キー`);
  await act(async () => {
    await Promise.resolve();
  });
  expect(field.type).toBe('password');
  expect(field.value).toBe('');
  expect(screen.queryByRole('group', { name: `${backend.label} の認証方法` })).toBeNull();
  const container = field.closest('li');
  if (!container) throw new Error('No backend form');
  for (const [key, button] of [
    ['first-synthetic', '保存'],
    ['second-synthetic', '更新'],
  ]) {
    fireEvent.change(field, { target: { value: key } });
    const submit = within(container).getByRole('button', { name: button });
    await act(async () => {
      fireEvent.click(submit);
      await Promise.resolve();
    });
    expect(settingsApi.backendApiKey).toHaveBeenLastCalledWith(backend.id, 'set', key);
    expect(field.value).toBe('');
  }
  const button = within(container).getByRole('button', { name: '削除' });
  await act(async () => {
    fireEvent.click(button);
    await Promise.resolve();
  });
  expect(settingsApi.backendApiKey).toHaveBeenLastCalledWith(backend.id, 'delete', undefined);
  expect(document.body.textContent).not.toContain('first-synthetic');
});
