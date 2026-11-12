import { create } from 'zustand';
import { DEFAULT_GUILD } from '@/shared/lib/guild';
import type { GuildProfile } from '@/shared/types/domain';
import { guildApi } from './api';
import { readCachedCrest, writeCachedCrest } from './model/crestCache';

interface GuildStoreState {
  /** スナップショットが届くまでは、名前は空・紋は前回覚えたもの */
  guild: GuildProfile;
}

export const useGuildStore = create<GuildStoreState>()(() => ({
  guild: { ...DEFAULT_GUILD, crest: readCachedCrest() },
}));

function apply(guild: GuildProfile): void {
  useGuildStore.setState({ guild });
  writeCachedCrest(guild.crest);
}

export function applyGuildSnapshot(guild: GuildProfile): void {
  apply(guild);
}

export async function saveGuild(guild: GuildProfile): Promise<GuildProfile> {
  const saved = await guildApi.update(guild);
  apply(saved);
  return saved;
}
