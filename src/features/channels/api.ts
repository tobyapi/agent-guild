import { invoke } from '@/shared/api';

export const channelsApi = {
  chooseFolder: () => invoke('choose_folder'),
  statistics: (channelId: string) => invoke('get_channel_statistics', { channelId }),
  create: (name: string, topic: string, memberIds: string[]) => invoke('create_channel', { name, topic, memberIds }),
  update: (id: string, name: string, topic: string) => invoke('update_channel', { id, name, topic }),
  workspace: (id: string, mode: 'legacy' | 'folder' | 'global', folder: string | null) =>
    invoke('set_channel_workspace', { id, mode, folder }),
  remove: (id: string) => invoke('delete_channel', { id }),
  addMember: (channelId: string, memberId: string) => invoke('add_channel_member', { channelId, memberId }),
  removeMember: (channelId: string, memberId: string) => invoke('remove_channel_member', { channelId, memberId }),
  stop: (channelId: string) => invoke('stop_channel', { channelId }),
};
