import type { Channel } from '@/shared/types/domain';
import { useChannelsStore } from '../store';
import type { ChannelDialogTarget } from '../store';

export function useChannels(): Channel[] {
  return useChannelsStore((state) => state.channels);
}

export function useActiveChannelId(): string | null {
  return useChannelsStore((state) => state.activeId);
}

/** 開いているチャンネル（なければ null） */
export function useActiveChannel(): Channel | null {
  return useChannelsStore((state) => state.channels.find((channel) => channel.id === state.activeId) ?? null);
}

export function useChannel(channelId: string | null): Channel | null {
  return useChannelsStore((state) => state.channels.find((channel) => channel.id === channelId) ?? null);
}

export function useMemberPanelOpen(): boolean {
  return useChannelsStore((state) => state.membersOpen);
}

export function useChannelDialog(): ChannelDialogTarget | null {
  return useChannelsStore((state) => state.dialog);
}
