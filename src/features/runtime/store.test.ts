import { beforeEach, expect, it, vi } from 'vitest';
import type { Snapshot } from '@/shared/types/domain';
import { notifyInfo } from '@/shared/ui';
import { runtimeApi } from './api';
import { applyRuntimeSnapshot, refreshBackends, useRuntimeStore } from './store';

vi.mock('./api', () => ({ runtimeApi: { refreshBackends: vi.fn(), snapshot: vi.fn() } }));
vi.mock('@/shared/ui', () => ({ notifyInfo: vi.fn() }));

const snapshot = {
  runtime: { state: 'ready', message: '' },
  backends: [{ id: 'grok', status: 'ready', statusMessage: 'APIキーとCLIを確認済み' }],
  activity: { activities: [], queues: [] },
} as unknown as Snapshot;

beforeEach(() => {
  vi.clearAllMocks();
  useRuntimeStore.setState({ checkingBackends: false, backends: [] });
  vi.mocked(runtimeApi.snapshot).mockResolvedValue(snapshot);
});

it('keeps checking through unrelated state events and fetches the completed result', async () => {
  let complete!: () => void;
  vi.mocked(runtimeApi.refreshBackends).mockReturnValue(
    new Promise((resolve) => {
      complete = () => resolve(null);
    }),
  );
  const refresh = refreshBackends();
  expect(useRuntimeStore.getState().checkingBackends).toBe(true);
  applyRuntimeSnapshot({ ...snapshot, backends: [] }, 0);
  expect(useRuntimeStore.getState().checkingBackends).toBe(true);
  await refreshBackends();
  expect(runtimeApi.refreshBackends).toHaveBeenCalledTimes(1);
  expect(runtimeApi.snapshot).not.toHaveBeenCalled();
  complete();
  await refresh;
  expect(useRuntimeStore.getState()).toMatchObject({ checkingBackends: false, backends: snapshot.backends });
  expect(notifyInfo).toHaveBeenCalledWith(expect.stringContaining('再確認が完了'));
});

it.each(['send', 'snapshot'])('propagates %s failures and permits retry', async (stage) => {
  const error = new Error('再確認に失敗');
  vi.mocked(runtimeApi.refreshBackends).mockResolvedValue(null);
  if (stage === 'send') vi.mocked(runtimeApi.refreshBackends).mockRejectedValueOnce(error);
  else vi.mocked(runtimeApi.snapshot).mockRejectedValueOnce(error);
  await expect(refreshBackends()).rejects.toBe(error);
  expect(useRuntimeStore.getState().checkingBackends).toBe(false);
  expect(notifyInfo).not.toHaveBeenCalled();
  await refreshBackends();
  expect(useRuntimeStore.getState().backends).toEqual(snapshot.backends);
});
