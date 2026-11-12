import { GUILD_NAME_MAX, guildNameTooLong } from '@/shared/lib/guild';
import type { GuildProfile } from '@/shared/types/domain';
import { t } from '../i18n';

/** ギルドの名前の検証（空はアプリ名を使う印なので許す。Rust の guild-domain guild.rs と同じ規則） */
export function validateGuild(guild: GuildProfile): Partial<Record<'name', string>> {
  return guildNameTooLong(guild.name) ? { name: t('nameTooLong', { max: GUILD_NAME_MAX }) } : {};
}
