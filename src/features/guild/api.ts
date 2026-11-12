import { invoke } from '@/shared/api';
import type { GuildProfile } from '@/shared/types/domain';

export const guildApi = {
  update: (guild: GuildProfile) => invoke('update_guild', { guild }),
};
