import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateApi } from './api';
import { INITIAL_UPDATE_STATE } from './model/update';
import { checkForUpdate, installUpdate, useUpdateStore } from './store';

vi.mock('./api', () => ({ updateApi: { check: vi.fn(), install: vi.fn() } }));

const available = { currentVersion: '0.1.0', latest: { version: '0.2.0', notes: '' } };

beforeEach(() => {
  vi.resetAllMocks();
  useUpdateStore.setState(INITIAL_UPDATE_STATE);
});

describe('checkForUpdate', () => {
  it('確かめた結果を持ち、返す', async () => {
    vi.mocked(updateApi.check).mockResolvedValue(available);
    expect(await checkForUpdate()).toEqual(available);
    expect(useUpdateStore.getState()).toEqual({ phase: 'idle', status: available, error: null });
  });

  it('確かめられなければ投げずに null を返し、理由を持つ。前の結果は消さず、次に成功したら理由を消す', async () => {
    useUpdateStore.setState({ status: available });
    vi.mocked(updateApi.check).mockRejectedValueOnce({ code: 'unavailable', message: '更新を確認できませんでした' });
    expect(await checkForUpdate()).toBeNull();
    expect(useUpdateStore.getState()).toEqual({
      phase: 'idle',
      status: available,
      error: '更新を確認できませんでした',
    });
    vi.mocked(updateApi.check).mockResolvedValue(available);
    await checkForUpdate();
    expect(useUpdateStore.getState().error).toBeNull();
  });

  it('確認中に重ねて呼んでも、問い合わせは1回だけ', async () => {
    vi.mocked(updateApi.check).mockResolvedValue(available);
    await Promise.all([checkForUpdate(), checkForUpdate()]);
    expect(updateApi.check).toHaveBeenCalledTimes(1);
  });
});

describe('installUpdate', () => {
  it('うまくいけば「更新中」のまま（アプリが起動し直す）。重ねて押しても1回だけ', async () => {
    vi.mocked(updateApi.install).mockResolvedValue(null);
    await Promise.all([installUpdate(), installUpdate()]);
    expect(updateApi.install).toHaveBeenCalledTimes(1);
    expect(useUpdateStore.getState().phase).toBe('installing');
  });

  it('失敗したら理由を持って、もう一度押せる状態に戻す', async () => {
    vi.mocked(updateApi.install).mockRejectedValue({
      code: 'unavailable',
      message: '更新をダウンロードできませんでした',
    });
    await installUpdate();
    expect(useUpdateStore.getState()).toMatchObject({ phase: 'idle', error: '更新をダウンロードできませんでした' });
  });
});
