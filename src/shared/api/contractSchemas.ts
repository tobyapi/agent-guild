// コマンドの戻り値とイベントのペイロードの検証表（開発時に、受け取った値が契約に合うかを確かめる）。
// 型は { [C in CommandName]: Validator } なので、コマンドを足して検証を書き忘れるとコンパイルエラーになる。
import { arrayOf, nullable, nullValue, objectOf, string } from '@/shared/types/schema';
import type { Validator } from '@/shared/types/schema';
import { delegationSchema } from '@/shared/types/schemas/delegation';
import { agentSchema, channelSchema, messageSchema, profileSchema } from '@/shared/types/schemas/entities';
import {
  builtinSkillSchema,
  skillLibrarySchema,
  skillSchema,
  skillsChangedSchema,
} from '@/shared/types/schemas/skills';
import { channelStatisticsSchema } from '@/shared/types/schemas/statistics';
import {
  activityStateSchema,
  bootStatusSchema,
  snapshotSchema,
  storageInfoSchema,
} from '@/shared/types/schemas/system';
import type { CommandName, EventName } from './contract';

const agent = objectOf(agentSchema);
const channel = objectOf(channelSchema);
const message = objectOf(messageSchema);
const skill = objectOf(skillSchema);
const skillLibrary = objectOf(skillLibrarySchema);
const delegation = objectOf(delegationSchema);

export const RESULT_VALIDATORS: { readonly [C in CommandName]: Validator } = {
  get_boot_status: objectOf(bootStatusSchema),
  get_snapshot: objectOf(snapshotSchema),
  create_agent: agent,
  update_agent: agent,
  delete_agent: nullValue,
  run_autonomous: nullValue,
  open_agent_workspace: nullValue,
  list_skills: arrayOf(skill),
  save_skill: skill,
  delete_skill: nullValue,
  list_builtin_skills: arrayOf(objectOf(builtinSkillSchema)),
  add_builtin_skill: skill,
  get_skill_library: skillLibrary,
  set_skill_library_dirs: skillLibrary,
  add_library_skill: skill,
  reveal_skill_folder: nullValue,
  create_channel: channel,
  get_channel_statistics: objectOf(channelStatisticsSchema),
  update_channel: channel,
  delete_channel: nullValue,
  add_channel_member: nullValue,
  remove_channel_member: nullValue,
  list_messages: arrayOf(message),
  send_message: message,
  get_attachment: string,
  reveal_attachment: nullValue,
  stop_channel: nullValue,
  list_delegations: arrayOf(delegation),
  update_profile: objectOf(profileSchema),
  backend_api_key: string,
  refresh_backends: nullValue,
  install_backend_cli: nullValue,
  start_ollama: nullValue,
  login_backend: nullValue,
  get_storage_info: objectOf(storageInfoSchema),
  choose_folder: nullable(string),
  change_data_dir: nullValue,
  reveal_data_dir: nullValue,
  restart_app: nullValue,
  complete_setup: nullValue,
  open_url: nullValue,
};

export const EVENT_VALIDATORS: { readonly [E in EventName]: Validator } = {
  'message-created': message,
  'activity-changed': objectOf(activityStateSchema),
  'state-changed': nullValue,
  'skills-changed': objectOf(skillsChangedSchema),
  'skill-library-changed': nullValue,
  'delegation-changed': delegation,
};

/** 契約に合わない値を受け取ったら開発者向けに警告する（動作は止めない） */
export function warnIfOffContract(validate: Validator, value: unknown, label: string): void {
  const problems = validate(value, label);
  if (problems.length > 0) console.warn(`[契約のずれ] ${label}\n${problems.join('\n')}`, value);
}
