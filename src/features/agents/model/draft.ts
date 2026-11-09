// エージェント編集画面の入力中の値（AgentDraft）と、その作り方・変え方。
import { presetColor } from '@/shared/lib/colors';
import { checkEffort, effortFrom } from '@/shared/lib/models';
import type {
  Agent,
  AgentTemplate,
  AgentTemplateDefaults,
  BackendInfo,
  PermissionKey,
  Permissions,
  UnmentionedPolicy,
} from '@/shared/types/domain';
import { tagKey } from './accent';
import { DEFAULT_INTERVAL_MIN } from './autonomy';
import { optionValuesFrom } from './backendOptions';
import type { OptionValues } from './backendOptions';
import { presetPersona } from './presets';
import type { AgentPreset } from './presets';

export interface AgentDraft {
  name: string;
  avatar: string;
  color: string;
  tags: string[];
  role: string;
  personality: string;
  tone: string;
  expertise: string;
  backend: string;
  model: string;
  /** 推論の深さ（空なら既定。backendOptions の effort に保存する） */
  effort: string;
  /** バックエンド固有設定の入力値（OptionSpec.key → 値） */
  optionValues: OptionValues;
  /** 保存されていた backendOptions（バックエンドの一覧が届いていないときにそのまま保つ） */
  storedOptions: Record<string, unknown>;
  permissions: Permissions;
  unmentioned: UnmentionedPolicy;
  consultable: boolean;
  canDelegate: boolean;
  autonomyEnabled: boolean;
  /** 入力中は文字列で持つ */
  autonomyIntervalMin: string;
  autonomyChannelId: string | null;
}

export type DraftUpdate = <K extends keyof AgentDraft>(key: K, value: AgentDraft[K]) => void;

/** テンプレートが届いていないときの既定値（何も許さず、話しかけられたら答える） */
const BLANK_DEFAULTS: AgentTemplateDefaults = {
  tags: [],
  role: '',
  expertise: '',
  permissions: {
    webSearch: false,
    webFetch: false,
    readFiles: false,
    writeFiles: false,
    writeAnywhere: false,
    runCommands: false,
    skills: false,
  },
  unmentioned: 'answer',
  consultable: false,
  canDelegate: false,
  autonomyEnabled: false,
};

/** テンプレートの既定値を入力中の値の形にする（配列とオブジェクトは写しにして、テンプレートを書き換えない） */
function fromDefaults(defaults: AgentTemplateDefaults): Pick<AgentDraft, keyof AgentTemplateDefaults> {
  return { ...defaults, tags: [...defaults.tags], permissions: { ...defaults.permissions } };
}

/** 新しいエージェントのバックエンド: 準備のできている最初のもの → なければ最初のもの */
function defaultBackend(backends: readonly BackendInfo[]): string {
  return (backends.find((backend) => backend.status === 'ready') ?? backends[0])?.id ?? '';
}

/**
 * テンプレートの既定値（タグ・担当・得意分野・権限・振る舞い・自発活動）を一括で入れる。入力済みの値も上書きする。
 * 作成時だけ使い、作成後のエージェントはテンプレートと結びつかない
 */
export function applyTemplate(draft: AgentDraft, template: AgentTemplate | undefined): AgentDraft {
  return { ...draft, ...fromDefaults(template?.defaults ?? BLANK_DEFAULTS) };
}

export function newDraft(
  template: AgentTemplate | undefined,
  backends: readonly BackendInfo[],
  colorIndex: number,
): AgentDraft {
  const blank: AgentDraft = {
    name: '',
    avatar: '🤖',
    color: presetColor(colorIndex),
    personality: '',
    tone: '',
    backend: defaultBackend(backends),
    model: '',
    effort: '',
    optionValues: {},
    storedOptions: {},
    autonomyIntervalMin: String(DEFAULT_INTERVAL_MIN),
    autonomyChannelId: null,
    ...fromDefaults(BLANK_DEFAULTS),
  };
  return applyTemplate(blank, template);
}

export function draftFromAgent(agent: Agent, backends: readonly BackendInfo[]): AgentDraft {
  const specs = backends.find((backend) => backend.id === agent.backend)?.options ?? [];
  return {
    name: agent.name,
    avatar: agent.avatar,
    color: agent.color,
    tags: agent.tags,
    role: agent.role,
    personality: agent.personality,
    tone: agent.tone,
    expertise: agent.expertise,
    backend: agent.backend,
    model: agent.model,
    effort: effortFrom(agent.backendOptions),
    optionValues: optionValuesFrom(specs, agent.backendOptions),
    storedOptions: agent.backendOptions,
    permissions: agent.permissions,
    unmentioned: agent.unmentioned,
    consultable: agent.consultable,
    canDelegate: agent.canDelegate,
    autonomyEnabled: agent.autonomyEnabled,
    autonomyIntervalMin: String(agent.autonomyIntervalMin),
    autonomyChannelId: agent.autonomyChannelId,
  };
}

/** 人格の書き出し例を流し込む（設定の値には触れない） */
export function applyPreset(draft: AgentDraft, preset: AgentPreset): AgentDraft {
  const { name, avatar, color, role, expertise } = preset.values;
  return { ...draft, name, avatar, color, role, expertise, ...presetPersona(preset.values) };
}

/** タグを先頭に入れる（サイドバーの区画の「＋」から作るとき。同じタグがあれば先頭へ移す） */
export function putHeadTag(draft: AgentDraft, tag: string): AgentDraft {
  return { ...draft, tags: [tag, ...draft.tags.filter((other) => tagKey(other) !== tagKey(tag))] };
}

/** バックエンドを変える。モデル・推論の深さ・固有設定はバックエンドごとに違うので既定に戻す */
export function changeBackend(draft: AgentDraft, backend: string): AgentDraft {
  if (draft.backend === backend) return draft;
  return { ...draft, backend, model: '', effort: '', optionValues: {}, storedOptions: {} };
}

/** モデルを変える。いまの推論の深さが新しいモデルで選べなければ既定に戻す */
export function changeModel(draft: AgentDraft, model: string, backend: BackendInfo | undefined): AgentDraft {
  const effort = checkEffort(backend, model, draft.effort) === null ? draft.effort : '';
  return { ...draft, model, effort };
}

export function setPermission(draft: AgentDraft, key: PermissionKey, on: boolean): AgentDraft {
  return { ...draft, permissions: { ...draft.permissions, [key]: on } };
}
