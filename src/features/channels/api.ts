import { invoke } from '@/shared/api';
import type { WorkspaceMode } from '@/shared/types/domain';

export const channelsApi = {
  chooseFolder: () => invoke('choose_folder'),
  statistics: (channelId: string) => invoke('get_channel_statistics', { channelId }),
  create: (name: string, topic: string, icon: string, memberIds: string[]) =>
    invoke('create_channel', { name, topic, icon, memberIds }),
  update: (id: string, name: string, topic: string, icon: string) =>
    invoke('update_channel', { id, name, topic, icon }),
  workspace: (id: string, mode: WorkspaceMode, folder: string | null) =>
    invoke('set_channel_workspace', { id, mode, folder }),
  remove: (id: string) => invoke('delete_channel', { id }),
  addMember: (channelId: string, memberId: string) => invoke('add_channel_member', { channelId, memberId }),
  removeMember: (channelId: string, memberId: string) => invoke('remove_channel_member', { channelId, memberId }),
  stop: (channelId: string) => invoke('stop_channel', { channelId }),
};
