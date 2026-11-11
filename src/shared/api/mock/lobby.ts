import type { MockState } from './state';

/** 旧データへの移行履歴を、チャンネルと同じ状態に記録する。 */
export function migrateLobby(state: Pick<MockState, 'channels' | 'lobbyMigrationApplied'>): boolean {
  if (state.lobbyMigrationApplied) return false;
  state.lobbyMigrationApplied = true;
  if (state.channels.some((channel) => channel.isLobby === true)) return false;
  const lobby = state.channels
    .filter((channel) => channel.isLobby === undefined && channel.name === 'ロビー')
    .sort((a, b) => a.createdAt - b.createdAt)[0];
  if (!lobby) return false;
  lobby.isLobby = true;
  return true;
}
