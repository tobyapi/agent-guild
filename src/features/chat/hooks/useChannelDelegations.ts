import { useEffect, useMemo } from 'react';
import type { Delegation } from '@/shared/types/domain';
import { loadDelegations, useDelegationStore } from '../delegationStore';
import { taskLinkIndex } from '../model/delegations';
import type { TaskLink } from '../model/delegations';

/** チャンネルの割り振り。開いたときに読み、id → 割り振り と 結果・まとめの発言 → カードへ戻る導線 を返す */
export function useChannelDelegations(channelId: string): {
  byId: Record<string, Delegation>;
  links: Map<string, TaskLink>;
} {
  const byId = useDelegationStore((state) => state.byId);
  useEffect(() => {
    void loadDelegations(channelId);
  }, [channelId]);
  const links = useMemo(
    () => taskLinkIndex(Object.values(byId).filter((delegation) => delegation.channelId === channelId)),
    [byId, channelId],
  );
  return { byId, links };
}
