import { useCallback, useEffect } from 'react';
import type { Message } from '@/shared/types/domain';
import { loadLatest, loadOlder, useChatStore } from '../store';
import type { ChannelLog } from '../store';

const EMPTY: readonly Message[] = [];

/** チャンネルの発言。初めて開いたときに最新のページを読む */
export function useChannelLog(channelId: string) {
  const log: ChannelLog | undefined = useChatStore((state) => state.logs[channelId]);
  useEffect(() => {
    void loadLatest(channelId);
  }, [channelId]);
  const requestOlder = useCallback(() => void loadOlder(channelId), [channelId]);
  return {
    messages: log?.messages ?? EMPTY,
    hasMore: log?.hasMore ?? false,
    ready: log?.status === 'ready',
    loadingOlder: log?.loadingOlder ?? false,
    liveAfterSeq: log?.liveAfterSeq ?? Number.MAX_SAFE_INTEGER,
    requestOlder,
  };
}
