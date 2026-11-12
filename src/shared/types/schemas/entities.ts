// domain のエンティティ（エージェント・テンプレート・チャンネル・発言・プロフィール）のスキーマ。スキルは skills.ts。
import type {
  Agent,
  AgentInput,
  AgentTemplate,
  Attachment,
  AgentTemplateDefaults,
  Channel,
  Message,
  MessageKind,
  PermissionKey,
  Permissions,
  Profile,
  UnmentionedPolicy,
  WorkspaceMode,
} from '../domain';
import { anything, arrayOf, boolean, nullable, number, objectOf, omitKeys, oneOf, recordOf, string } from '../schema';
import type { Schema } from '../schema';

export const permissionKey = oneOf<PermissionKey>({
  webSearch: true,
  webFetch: true,
  readFiles: true,
  readAnywhere: true,
  writeFiles: true,
  writeAnywhere: true,
  runCommands: true,
  skills: true,
});

export const permissionsSchema = {
  webSearch: boolean,
  webFetch: boolean,
  readFiles: boolean,
  readAnywhere: boolean,
  writeFiles: boolean,
  writeAnywhere: boolean,
  runCommands: boolean,
  skills: boolean,
} satisfies Schema<Permissions>;

export const unmentionedPolicy = oneOf<UnmentionedPolicy>({ lead: true, answer: true, fallback: true, ignore: true });

export const agentSchema = {
  id: string,
  name: string,
  avatar: string,
  color: string,
  tags: arrayOf(string),
  role: string,
  personality: string,
  tone: string,
  expertise: string,
  backend: string,
  model: string,
  backendOptions: recordOf(anything),
  permissions: objectOf(permissionsSchema),
  unmentioned: unmentionedPolicy,
  consultable: boolean,
  canDelegate: boolean,
  autonomyEnabled: boolean,
  autonomyIntervalMin: number,
  autonomyChannelId: nullable(string),
  lastAutonomousAt: nullable(number),
  createdAt: number,
  deletedAt: nullable(number),
} satisfies Schema<Agent>;

export const agentInputSchema: Schema<AgentInput> = omitKeys(agentSchema, [
  'id',
  'createdAt',
  'lastAutonomousAt',
  'deletedAt',
]);

const templateDefaultsSchema = {
  tags: arrayOf(string),
  role: string,
  expertise: string,
  permissions: objectOf(permissionsSchema),
  unmentioned: unmentionedPolicy,
  consultable: boolean,
  canDelegate: boolean,
  autonomyEnabled: boolean,
} satisfies Schema<AgentTemplateDefaults>;

export const agentTemplateSchema = {
  id: string,
  label: string,
  description: string,
  accent: nullable(string),
  builtinSkills: arrayOf(string),
  roleTags: arrayOf(string),
  defaults: objectOf(templateDefaultsSchema),
} satisfies Schema<AgentTemplate>;

const workspaceSchema = objectOf({
  mode: oneOf<WorkspaceMode>({ shared: true, folder: true, global: true }),
  folder: nullable(string),
  revision: number,
  afterSeq: number,
});
export const channelSchema = {
  workspace: workspaceSchema,
  isLobby: boolean,
  id: string,
  name: string,
  topic: string,
  memberIds: arrayOf(string),
  createdAt: number,
} satisfies Schema<Channel>;

export const attachmentSchema = {
  id: string,
  name: string,
  mediaType: string,
  size: number,
} satisfies Schema<Attachment>;

export const messageSchema = {
  id: string,
  seq: number,
  channelId: string,
  authorId: string,
  content: string,
  attachments: arrayOf(objectOf(attachmentSchema)),
  kind: oneOf<MessageKind>({ chat: true, autonomous: true, progress: true, system: true, error: true }),
  mentions: arrayOf(string),
  replyToId: nullable(string),
  rootId: string,
  depth: number,
  delegationId: nullable(string),
  createdAt: number,
} satisfies Schema<Message>;

export const profileSchema = { name: string, avatar: string, color: string } satisfies Schema<Profile>;
