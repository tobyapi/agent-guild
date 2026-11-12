import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHarness } from './harness.test-support';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('モックのアプリの更新', () => {
  it('ふだんは最新。新しい版がなければ install_update は conflict', async () => {
    const mock = await createHarness();
    expect(await mock.transport.invoke('check_update', {})).toEqual({ currentVersion: '0.1.0', latest: null });
    await expect(mock.transport.invoke('install_update', {})).rejects.toMatchObject({ code: 'conflict' });
    expect(mock.restart).not.toHaveBeenCalled();
  });

  it('新しい版が出ていれば知らせ、install_update で起動し直す', async () => {
    const mock = await createHarness({ updateAvailable: true });
    const status = await mock.transport.invoke('check_update', {});
    expect(status.latest?.version).toBe('0.2.0');
    expect(await mock.transport.invoke('install_update', {})).toBeNull();
    await mock.settle();
    expect(mock.restart).toHaveBeenCalledTimes(1);
  });

  it('復旧モードでも確かめられる（壊れた版を、更新で直せるように）', async () => {
    const mock = await createHarness({ bootFailure: 'missing', updateAvailable: true });
    expect((await mock.transport.invoke('check_update', {})).latest?.version).toBe('0.2.0');
  });
});
