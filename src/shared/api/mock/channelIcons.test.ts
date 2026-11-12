// モックのチャンネルのアイコン: Rust と同じ規則で正規化し、不正なら validation（field: icon）で何も変えない。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SEED_IDS } from './seedIds';
import { createHarness } from './harness.test-support';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('モックのチャンネルのアイコン', () => {
  it('作成と更新で正規化して保存する', async () => {
    const mock = await createHarness();
    const channel = await mock.transport.invoke('create_channel', {
      name: '設計',
      topic: '',
      icon: ' 🎨 ',
      memberIds: [],
    });
    expect(channel.icon).toBe('🎨');
    const updated = await mock.transport.invoke('update_channel', {
      id: channel.id,
      name: '設計',
      topic: '',
      icon: '#',
    });
    expect(updated.icon).toBe('');
  });

  it('不正なアイコンは validation で拒み、元のまま', async () => {
    const mock = await createHarness();
    const invalid = { id: SEED_IDS.lobby, name: 'ロビー', topic: '', icon: 'ab' };
    await expect(mock.transport.invoke('update_channel', invalid)).rejects.toMatchObject({ field: 'icon' });
    const snapshot = await mock.transport.invoke('get_snapshot', {});
    expect(snapshot.channels.find((entry) => entry.id === SEED_IDS.lobby)?.icon).toBe('');
  });
});
