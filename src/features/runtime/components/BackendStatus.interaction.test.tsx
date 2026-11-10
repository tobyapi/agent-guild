// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ToastViewport } from '@/shared/ui';
import type { BackendInfo, Snapshot } from '@/shared/types/domain';
import { runtimeApi } from '../api';
import { useRuntimeStore } from '../store';
import { useToastStore } from '@/shared/ui/toast/store';
import { BackendStatus } from './BackendStatus';

function BackendsSection() {
  const backends = useRuntimeStore((state) => state.backends);
  return (
    <>
      {backends.map((backend) => (
        <BackendStatus key={backend.id} backend={backend} />
      ))}
    </>
  );
}

vi.mock('../api', () => ({ runtimeApi: { refreshBackends: vi.fn(), snapshot: vi.fn(), startOllama: vi.fn() } }));

const grok = {
  id: 'grok',
  label: 'Grok',
  status: 'needs_auth',
  statusMessage: 'APIキーを設定してください',
  canLogin: false,
} as BackendInfo;

beforeEach(() => {
  vi.clearAllMocks();
  useToastStore.setState({ toasts: [] });
  useRuntimeStore.setState({ checkingBackends: false, startingOllama: false, backends: [grok] });
});
afterEach(cleanup);

it('shows checking, refreshed readiness and a completion notice after clicking recheck', async () => {
  let complete!: () => void;
  vi.mocked(runtimeApi.refreshBackends).mockReturnValue(
    new Promise((resolve) => {
      complete = () => resolve(null);
    }),
  );
  vi.mocked(runtimeApi.snapshot).mockResolvedValue({
    runtime: { state: 'ready', message: '' },
    backends: [{ ...grok, status: 'ready', statusMessage: 'キーとCLIを確認済み' }],
    activity: { activities: [], queues: [] },
  } as unknown as Snapshot);
  await act(async () => {
    await Promise.resolve();
    render(
      <>
        <BackendsSection />
        <ToastViewport />
      </>,
    );
  });
  fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: '再確認' }));
  expect(
    screen.getAllByRole('button', { name: '確認中…' }).every((button) => (button as HTMLButtonElement).disabled),
  ).toBe(true);
  await act(async () => {
    await Promise.resolve();
    complete();
  });
  expect(screen.getByText('準備 OK')).toBeTruthy();
  expect(screen.getByText(/再確認が完了/)).toBeTruthy();
});

it('shows the failure and re-enables recheck after a rejected command', async () => {
  vi.mocked(runtimeApi.refreshBackends).mockRejectedValue(new Error('バックエンドの再確認がタイムアウトしました'));
  await act(async () => {
    await Promise.resolve();
    render(
      <>
        <BackendsSection />
        <ToastViewport />
      </>,
    );
  });
  await act(async () => {
    await Promise.resolve();
    fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: '再確認' }));
  });
  // jsdom has no popover top layer; inspect the alert that the viewport renders.
  expect(screen.getByRole('alert', { hidden: true }).textContent).toContain('タイムアウト');
  expect(screen.getByRole<HTMLButtonElement>('button', { name: '再確認' }).disabled).toBe(false);
  expect(screen.queryByText(/再確認が完了/)).toBeNull();
});

it('Ollama を起動し、一覧の取得が終わるまで再クリックを防ぐ', async () => {
  const ollama: BackendInfo = { ...grok, id: 'ollama', label: 'Ollama（この PC）', status: 'stopped' };
  useRuntimeStore.setState({ backends: [ollama] });
  let complete!: () => void;
  vi.mocked(runtimeApi.startOllama).mockReturnValueOnce(
    new Promise((resolve) => {
      complete = () => resolve(null);
    }),
  );
  const model = { id: 'gemma4:26b', label: 'gemma4:26b', description: '', efforts: [], defaultEffort: null };
  vi.mocked(runtimeApi.snapshot).mockResolvedValue({
    runtime: { state: 'ready', message: '' },
    backends: [{ ...ollama, status: 'ready', models: [model] }],
    activity: { activities: [], queues: [] },
  } as unknown as Snapshot);
  render(<BackendsSection />);
  fireEvent.click(screen.getByRole('button', { name: 'Ollama を起動' }));
  const pending = screen.getByRole<HTMLButtonElement>('button', { name: '起動中…' });
  expect(pending.disabled).toBe(true);
  fireEvent.click(pending);
  expect(runtimeApi.startOllama).toHaveBeenCalledTimes(1);
  await act(async () => {
    complete();
    await Promise.resolve();
  });
  expect(screen.getByText('準備 OK')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Ollama を起動' })).toBeNull();
  expect(useRuntimeStore.getState().backends[0]?.models).toEqual([model]);
});
