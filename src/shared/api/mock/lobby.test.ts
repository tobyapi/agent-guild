import { expect, it } from 'vitest';
import { migrateLobby } from './lobby';
import type { MockState } from './state';

it('旧データの最古のロビーだけを移行し、2回目は変更しない', () => {
  const channels = [
    { id: 'new', name: 'ロビー', topic: '', memberIds: ['me'], createdAt: 2 },
    { id: 'old', name: 'ロビー', topic: '', memberIds: ['me'], createdAt: 1 },
  ];
  const state: Pick<MockState, 'channels' | 'lobbyMigrationApplied'> = { channels };
  expect(migrateLobby(state)).toBe(true);
  expect(channels[0]).not.toHaveProperty('isLobby');
  expect(channels[1]).toHaveProperty('isLobby', true);
  channels[1]!.name = 'Lounge';
  expect(migrateLobby(state)).toBe(false);
});

it('移行後にロビーを削除し同名チャンネルを作っても再移行しない', () => {
  const state: Pick<MockState, 'channels' | 'lobbyMigrationApplied'> = {
    channels: [
      { id: 'old', name: 'ロビー', topic: '', memberIds: ['me'], createdAt: 1 },
      { id: 'remaining', name: 'ロビー', topic: '', memberIds: ['me'], createdAt: 2 },
    ],
  };
  expect(migrateLobby(state)).toBe(true);
  // 状態のコピー後にも移行履歴を保持する。
  const reloaded = structuredClone(state);
  reloaded.channels = reloaded.channels.filter((channel) => channel.isLobby !== true);
  reloaded.channels.push({ id: 'normal', name: 'ロビー', topic: '', memberIds: ['me'], createdAt: 3, isLobby: false });
  expect(migrateLobby(reloaded)).toBe(false);
  expect(reloaded.channels.some((channel) => channel.isLobby === true)).toBe(false);
});

it('isLobby: false と明示されたロビーは格上げしない', () => {
  const state: Pick<MockState, 'channels' | 'lobbyMigrationApplied'> = {
    channels: [{ id: 'normal', name: 'ロビー', topic: '', memberIds: ['me'], createdAt: 1, isLobby: false }],
  };
  expect(migrateLobby(state)).toBe(false);
  expect(state.channels[0]?.isLobby).toBe(false);
  expect(state.lobbyMigrationApplied).toBe(true);
});
