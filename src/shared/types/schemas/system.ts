// domain の実行環境・状態・保存先・起動・エラーのスキーマと、それらを束ねる Snapshot のスキーマ。
import type {
  ActivityState,
  AgentActivity,
  AvailableUpdate,
  BackendInfo,
  BackendStatus,
  BootReason,
  BootState,
  BootStatus,
  ChannelQueue,
  CommandError,
  ErrorCode,
  MidRunPost,
  ModelSpec,
  OptionSpec,
  PermissionRule,
  RuntimeState,
  RuntimeStatus,
  Snapshot,
  StorageInfo,
  StorageSource,
  UpdateStatus,
} from '../domain';
import { anyOf, arrayOf, boolean, nullable, number, objectOf, oneOf, string } from '../schema';
import type { Schema } from '../schema';
import {
  agentSchema,
  agentTemplateSchema,
  channelSchema,
  permissionKey,
  permissionsSchema,
  profileSchema,
} from './entities';

export const optionSpecSchema = {
  key: string,
  label: string,
  description: string,
  type: oneOf<OptionSpec['type']>({ string: true, number: true, boolean: true, select: true }),
  choices: arrayOf(string),
  default: nullable(anyOf(string, number, boolean)),
} satisfies Schema<OptionSpec>;

export const permissionRuleSchema = {
  when: permissionKey,
  requires: arrayOf(permissionKey),
} satisfies Schema<PermissionRule>;

export const modelSpecSchema = {
  id: string,
  label: string,
  description: string,
  efforts: arrayOf(string),
  defaultEffort: nullable(string),
  tools: (value, path) => (value === undefined ? [] : boolean(value, path)),
} satisfies Schema<ModelSpec>;

export const backendInfoSchema = {
  id: string,
  label: string,
  models: arrayOf(objectOf(modelSpecSchema)),
  defaultModel: string,
  capabilities: objectOf(permissionsSchema),
  status: oneOf<BackendStatus>({ ready: true, needs_auth: true, stopped: true, unavailable: true }),
  statusMessage: string,
  options: arrayOf(objectOf(optionSpecSchema)),
  permissionRules: arrayOf(objectOf(permissionRuleSchema)),
  leakRisks: arrayOf(arrayOf(permissionKey)),
  unrestricted: arrayOf(permissionKey),
  canLogin: boolean,
  midRunPost: nullable(oneOf<MidRunPost>({ tool: true, text: true })),
} satisfies Schema<BackendInfo>;

export const runtimeStatusSchema = {
  state: oneOf<RuntimeState>({ starting: true, ready: true, unavailable: true }),
  message: string,
} satisfies Schema<RuntimeStatus>;

export const agentActivitySchema = {
  agentId: string,
  channelId: string,
  detail: string,
} satisfies Schema<AgentActivity>;

export const channelQueueSchema = {
  channelId: string,
  running: number,
  pending: number,
} satisfies Schema<ChannelQueue>;

export const activityStateSchema = {
  activities: arrayOf(objectOf(agentActivitySchema)),
  queues: arrayOf(objectOf(channelQueueSchema)),
} satisfies Schema<ActivityState>;

export const snapshotSchema = {
  me: objectOf(profileSchema),
  agents: arrayOf(objectOf(agentSchema)),
  channels: arrayOf(objectOf(channelSchema)),
  backends: arrayOf(objectOf(backendInfoSchema)),
  templates: arrayOf(objectOf(agentTemplateSchema)),
  runtime: objectOf(runtimeStatusSchema),
  activity: objectOf(activityStateSchema),
} satisfies Schema<Snapshot>;

export const storageInfoSchema = {
  dataDir: string,
  defaultDataDir: string,
  source: oneOf<StorageSource>({ default: true, settings: true, env: true }),
} satisfies Schema<StorageInfo>;

export const updateStatusSchema = {
  currentVersion: string,
  latest: nullable(objectOf({ version: string, notes: string } satisfies Schema<AvailableUpdate>)),
} satisfies Schema<UpdateStatus>;

export const bootStatusSchema = {
  state: oneOf<BootState>({ ok: true, recovery: true }),
  reason: oneOf<BootReason>({
    none: true,
    missing: true,
    locked: true,
    newer_version: true,
    foreign: true,
    corrupt: true,
    not_writable: true,
  }),
  dataDir: string,
  message: string,
  needsSetup: boolean,
} satisfies Schema<BootStatus>;

export const errorCodeEnum = oneOf<ErrorCode>({
  not_found: true,
  validation: true,
  conflict: true,
  storage: true,
  runtime: true,
  unavailable: true,
  internal: true,
});

export const commandErrorSchema = {
  code: errorCodeEnum,
  message: string,
  field: nullable(string),
} satisfies Schema<CommandError>;
