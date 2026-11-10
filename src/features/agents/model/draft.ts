// エージェント編集画面の入力中の値（AgentDraft）と、その作り方・変え方。
import { presetColor } from '@/shared/lib/colors';
import { checkEffort, effortFrom } from '@/shared/lib/models';
import { PERMISSION_ORDER, permissionRuleProblem } from '@/shared/lib/permissions';
import type {
  Agent,
  AgentTemplate,
  AgentTemplateDefaults,
  BackendInfo,
  Permissions,
  UnmentionedPolicy,
} from '@/shared/types/domain';
import { tagKey, templateOfTag } from './accent';
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

/** 権限をそのまま使えるバックエンドを優先し、その中で準備済みのものから選ぶ。 */
function withCompatibleBackend(draft: AgentDraft, backends: readonly BackendInfo[]): AgentDraft {
  const compatible = backends.filter(
    (backend) =>
      PERMISSION_ORDER.every((key) => !draft.permissions[key] || backend.capabilities[key]) &&
      permissionRuleProblem(backend, draft.permissions) === null,
  );
  const choices = compatible.length > 0 ? compatible : backends;
  const backend = choices.find((candidate) => candidate.status === 'ready') ?? choices[0];
  return backend ? changeBackend(draft, backend.id) : draft;
}

/**
 * テンプレートの既定値（タグ・担当・得意分野・権限・振る舞い・自発活動）を一括で入れる。入力済みの値も上書きする。
 * 作成時だけ使い、固定権限は先頭タグに対応する役割から別途求める
 */
export function applyTemplate(
  draft: AgentDraft,
  template: AgentTemplate | undefined,
  backends: readonly BackendInfo[] = [],
): AgentDraft {
  return withCompatibleBackend({ ...draft, ...fromDefaults(template?.defaults ?? BLANK_DEFAULTS) }, backends);
}

/** 編集時の役割変更。人格・モデル・追加タグは保ち、役割の権限と基本の応答方法を切り替える。 */
export function changeRole(
  draft: AgentDraft,
  template: AgentTemplate,
  templates: readonly AgentTemplate[],
): AgentDraft {
  const extras = templateOfTag(templates, draft.tags[0] ?? '') ? draft.tags.slice(1) : draft.tags;
  const { permissions, unmentioned, consultable, canDelegate } = template.defaults;
  return {
    ...draft,
    permissions: { ...permissions },
    unmentioned,
    consultable,
    canDelegate,
    tags: [
      ...template.defaults.tags,
      ...extras.filter((tag) => tagKey(tag) !== tagKey(template.defaults.tags[0] ?? '')),
    ],
  };
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
    backend: '',
    model: '',
    effort: '',
    optionValues: {},
    storedOptions: {},
    autonomyIntervalMin: String(DEFAULT_INTERVAL_MIN),
    autonomyChannelId: null,
    ...fromDefaults(BLANK_DEFAULTS),
  };
  return applyTemplate(blank, template, backends);
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
