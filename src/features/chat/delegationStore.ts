// 割り振り（マネージャーのタスク）。チャンネルを開いたら list_delegations で読み、delegation-changed で id ごとに置き換える。
import { create } from 'zustand';
import { reportError } from '@/shared/ui';
import type { Delegation } from '@/shared/types/domain';
import { chatApi } from './api';
import { isNewer } from './model/delegations';

interface DelegationStoreState {
  /** id → 割り振り（読み込んだチャンネルの分と、イベントで届いた分） */
  byId: Record<string, Delegation>;
  /** 読み込み済み・読み込み中のチャンネル */
  loaded: Record<string, true>;
}

export const useDelegationStore = create<DelegationStoreState>()(() => ({ byId: {}, loaded: {} }));

function merge(incoming: readonly Delegation[]): void {
  useDelegationStore.setState((state) => {
    const byId = { ...state.byId };
    for (const delegation of incoming) if (isNewer(delegation, byId[delegation.id])) byId[delegation.id] = delegation;
    return { byId };
  });
}

/** delegation-changed: 全体の最新の値で置き換える（届いた順が前後しても新しいほうを残す） */
export function receiveDelegation(delegation: Delegation): void {
  merge([delegation]);
}

/** チャンネルの割り振りを読む（読み込み済みなら何もしない。あとはイベントで最新に保たれる） */
export async function loadDelegations(channelId: string): Promise<void> {
  if (useDelegationStore.getState().loaded[channelId]) return;
  useDelegationStore.setState((state) => ({ loaded: { ...state.loaded, [channelId]: true } }));
  try {
    merge(await chatApi.delegations(channelId));
  } catch (error) {
    useDelegationStore.setState((state) => {
      const loaded = { ...state.loaded };
      delete loaded[channelId];
      return { loaded };
    });
    reportError(error);
  }
}
