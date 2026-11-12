// ギルドの名前と紋。
import { cleanGuild, GUILD_NAME_MAX, guildNameTooLong } from '@/shared/lib/guild';
import { emitStateChanged, fail } from '../runtime';
import type { HandlerGroup } from './types';

export const guildHandlers: HandlerGroup<'update_guild'> = {
  update_guild({ guild }, runtime) {
    if (guildNameTooLong(guild.name)) fail('validation', `ギルド名は${GUILD_NAME_MAX}文字以内にしてください`, 'name');
    runtime.state.guild = cleanGuild(guild);
    emitStateChanged(runtime);
    return runtime.state.guild;
  },
};
