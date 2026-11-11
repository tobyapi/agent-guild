// エージェントの入力の検証と AgentInput への変換（docs/design.md §2 入力規則。正はサーバの validation）。
import { checkAvatar } from '@/shared/lib/avatar';
import { isHexColor } from '@/shared/lib/colors';
import { checkEffort, withEffort } from '@/shared/lib/models';
import { checkMemberName } from '@/shared/lib/names';
import { checkTags, cleanTags } from '@/shared/lib/tags';
import type { AgentInput, BackendInfo, ErrorCode } from '@/shared/types/domain';
import { checkIntervalMin, DEFAULT_INTERVAL_MIN, parseIntervalMin } from './autonomy';
import { parseOptionValues } from './backendOptions';
import type { AgentDraft } from './draft';
import { rolePermissions, modelPermissions } from '@/shared/lib/permissionPolicy';
import type { AgentTemplate } from '@/shared/types/domain';

export type AgentField =
  'name' | 'avatar' | 'color' | 'tags' | 'backend' | 'effort' | 'permissions' | 'autonomyIntervalMin';

const AGENT_FIELDS: readonly AgentField[] = [
  'name',
  'avatar',
  'color',
  'tags',
  'backend',
  'permissions',
  'autonomyIntervalMin',
];
export type AgentErrors = Partial<Record<AgentField, string>>;

export interface ValidationContext {
  backends: readonly BackendInfo[];
  templates: readonly AgentTemplate[];
  /** 重複してはいけない名前（削除されていない他のエージェントと人間のプロフィール名） */
  takenNames: readonly string[];
}

export type DraftResult =
  { ok: true; input: AgentInput } | { ok: false; errors: AgentErrors; optionErrors: Record<string, string> };

function fieldErrors(draft: AgentDraft, ctx: ValidationContext): AgentErrors {
  const backend = ctx.backends.find((candidate) => candidate.id === draft.backend);
  const entries: Array<[AgentField, string | null]> = [
    ['name', checkMemberName(draft.name, ctx.takenNames)],
    ['avatar', checkAvatar(draft.avatar)],
    ['color', isHexColor(draft.color) ? null : '色を選んでください'],
    ['tags', checkTags(draft.tags)],
    ['backend', draft.backend === '' ? 'バックエンドを選んでください' : null],
    ['effort', checkEffort(backend, draft.model.trim(), draft.effort)],
    ['autonomyIntervalMin', checkIntervalMin(draft.autonomyIntervalMin)],
  ];
  return Object.fromEntries(entries.filter((entry): entry is [AgentField, string] => entry[1] !== null));
}

/** 保存用の入力（前後の空白を除き、タグの重複をまとめる） */
function toInput(draft: AgentDraft, backendOptions: Record<string, unknown>): AgentInput {
  return {
    name: draft.name.trim(),
    avatar: draft.avatar.trim(),
    color: draft.color,
    tags: cleanTags(draft.tags),
    role: draft.role.trim(),
    personality: draft.personality.trim(),
    tone: draft.tone.trim(),
    expertise: draft.expertise.trim(),
    backend: draft.backend,
    model: draft.model.trim(),
    backendOptions: withEffort(backendOptions, draft.effort),
    permissions: draft.permissions,
    unmentioned: draft.unmentioned,
    consultable: draft.consultable,
    canDelegate: draft.canDelegate,
    autonomyEnabled: draft.autonomyEnabled,
    autonomyIntervalMin: parseIntervalMin(draft.autonomyIntervalMin) ?? DEFAULT_INTERVAL_MIN,
    autonomyChannelId: draft.autonomyChannelId,
  };
}

/** 入力を検証し、問題がなければ保存する形（AgentInput）にする */
export function validateAgentDraft(draft: AgentDraft, ctx: ValidationContext): DraftResult {
  draft = {
    ...draft,
    permissions: modelPermissions(
      rolePermissions(ctx.templates, draft.tags),
      ctx.backends.find((backend) => backend.id === draft.backend),
      draft.model,
      draft.optionValues,
      draft.backend,
    ),
  };
  const errors = fieldErrors(draft, ctx);
  const toolError = toolModelError(draft, ctx);
  if (toolError) errors.permissions = toolError;
  const backend = ctx.backends.find((candidate) => candidate.id === draft.backend);
  const parsed = backend ? parseOptionValues(backend.options, draft.optionValues) : null;
  const optionErrors = parsed?.errors ?? {};
  if (Object.keys(errors).length > 0 || Object.keys(optionErrors).length > 0)
    return { ok: false, errors, optionErrors };
  // バックエンドの一覧が届いていなければ、保存されていた設定をそのまま保つ
  return { ok: true, input: toInput(draft, parsed?.options ?? draft.storedOptions) };
}

/** 保存で返ったエラー（CommandError.field）がどの入力のことか（分からなければ null。ダイアログの先頭の帯に出す） */
export function agentErrorField(code: ErrorCode | null, field: string | null): AgentField | null {
  if (code !== 'validation') return null;
  return AGENT_FIELDS.find((known) => known === field) ?? null;
}

function toolModelError(draft: AgentDraft, ctx: ValidationContext): string | null {
  if (draft.backend !== 'ollama' || draft.optionValues.enableTools !== true) return null;
  const info = ctx.backends.find((candidate) => candidate.id === draft.backend);
  return info?.models.find((model) => model.id === (draft.model || info.defaultModel))?.tools === true
    ? null
    : '道具に対応したモデルを選んでください';
}
