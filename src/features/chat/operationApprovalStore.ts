import { create } from 'zustand';
import type { OperationApproval } from '@/shared/types/domain';
import { chatApi } from './api';

const COMPLETED_LIMIT = 30;

export const useOperationApprovals = create<{ cards: OperationApproval[] }>()(() => ({ cards: [] }));

function mergeApprovals(incoming: readonly OperationApproval[]): void {
  if (incoming.length === 0) return;
  useOperationApprovals.setState(({ cards }) => {
    const byId = new Map(cards.map((card) => [card.requestId, card]));
    for (const card of incoming) {
      if (card.status !== 'pending' || !byId.has(card.requestId)) {
        byId.set(card.requestId, card);
      }
    }
    const merged = [...byId.values()];
    const recent = new Set(merged.filter((card) => card.status !== 'pending').slice(-COMPLETED_LIMIT));
    return { cards: merged.filter((card) => card.status === 'pending' || recent.has(card)) };
  });
}

export function receiveOperationApproval(card: OperationApproval): void {
  mergeApprovals([card]);
}

export async function loadOperationApprovals(channelId: string): Promise<void> {
  mergeApprovals(await chatApi.operationApprovals(channelId));
}
