// チャンネル（Snapshot.channels）・開いているチャンネル・メンバーパネルの開閉・作成と編集のダイアログ。
import { create } from 'zustand';
import type { Channel, WorkspaceMode } from '@/shared/types/domain';
import { channelsApi } from './api';
import { resolveActiveChannel } from './model/channels';

export type ChannelDialogTarget = { mode: 'create' } | { mode: 'edit'; channelId: string };

interface ChannelsStoreState {
  channels: Channel[];
  activeId: string | null;
  membersOpen: boolean;
  dialog: ChannelDialogTarget | null;
}

export const useChannelsStore = create<ChannelsStoreState>()(() => ({
  channels: [],
  activeId: null,
  membersOpen: true,
  dialog: null,
}));

function isEditable(dialog: ChannelDialogTarget | null, channels: readonly Channel[]): boolean {
  return dialog?.mode !== 'edit' || channels.some((channel) => channel.id === dialog.channelId);
}

/** スナップショットを反映する。開いていたチャンネルが消えていたら先頭へ移る */
export function applyChannelsSnapshot(channels: Channel[]): void {
  useChannelsStore.setState((state) => ({
    channels,
    activeId: resolveActiveChannel(channels, state.activeId),
    dialog: isEditable(state.dialog, channels) ? state.dialog : null,
  }));
}

export function selectChannel(channelId: string): void {
  useChannelsStore.setState({ activeId: channelId });
}

export function toggleMemberPanel(): void {
  useChannelsStore.setState((state) => ({ membersOpen: !state.membersOpen }));
}

export function openChannelCreator(): void {
  useChannelsStore.setState({ dialog: { mode: 'create' } });
}

export function openChannelEditor(channelId: string): void {
  useChannelsStore.setState({ dialog: { mode: 'edit', channelId } });
}

export function closeChannelDialog(): void {
  useChannelsStore.setState({ dialog: null });
}

function upsert(channel: Channel): void {
  useChannelsStore.setState((state) => ({
    channels: state.channels.some((candidate) => candidate.id === channel.id)
      ? state.channels.map((candidate) => (candidate.id === channel.id ? channel : candidate))
      : [...state.channels, channel],
  }));
}

/** 作成したチャンネルを開く */
export async function createChannel(name: string, topic: string, icon: string, memberIds: string[]): Promise<Channel> {
  const channel = await channelsApi.create(name, topic, icon, memberIds);
  upsert(channel);
  selectChannel(channel.id);
  return channel;
}

export async function updateChannel(id: string, name: string, topic: string, icon: string): Promise<Channel> {
  const channel = await channelsApi.update(id, name, topic, icon);
  upsert(channel);
  return channel;
}

export async function setChannelWorkspace(id: string, mode: WorkspaceMode, folder: string | null): Promise<Channel> {
  const channel = await channelsApi.workspace(id, mode, folder);
  upsert(channel);
  return channel;
}

export async function deleteChannel(id: string): Promise<void> {
  await channelsApi.remove(id);
  applyChannelsSnapshot(useChannelsStore.getState().channels.filter((channel) => channel.id !== id));
}

export async function addChannelMember(channelId: string, memberId: string): Promise<void> {
  await channelsApi.addMember(channelId, memberId);
}

export async function removeChannelMember(channelId: string, memberId: string): Promise<void> {
  await channelsApi.removeMember(channelId, memberId);
}

export async function stopChannel(channelId: string): Promise<void> {
  await channelsApi.stop(channelId);
}
