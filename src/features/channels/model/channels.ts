// チャンネルまわりの純粋なロジック。
import { normalizeChannelIcon } from '@/shared/lib/channelIcon';
import { CHANNEL_NAME_MAX, CHANNEL_TOPIC_MAX, cleanChannelName } from '@/shared/lib/limits';
import { groupByPrimaryTag } from '@/features/agents';
import type { TagGroup } from '@/features/agents';
import { checkText } from '@/shared/lib/validation';
import type { Agent, AgentTemplate, BackendInfo, Channel, FolderScope, WorkspaceMode } from '@/shared/types/domain';
import { t } from '../i18n';
import { tIcon } from '../i18n/icon';

/** 開いているチャンネル: 今のものが残っていればそれ、なければ先頭（チャンネルがなければ null） */
export function resolveActiveChannel(channels: readonly Channel[], currentId: string | null): string | null {
  return channels.some((channel) => channel.id === currentId) ? currentId : (channels[0]?.id ?? null);
}

/** メンバーの区画（サイドバーと同じ先頭のタグの区分。メンバーのいない区分は出さない。エージェントは作成順） */
export function memberGroups(
  channel: Channel,
  agents: readonly Agent[],
  templates: readonly AgentTemplate[],
): TagGroup[] {
  const members = agents.filter((agent) => agent.deletedAt === null && channel.memberIds.includes(agent.id));
  return groupByPrimaryTag(members, templates);
}

/** メンバーに追加できるエージェント（削除されておらず、まだいない人） */
export function addableAgents(channel: Channel, agents: readonly Agent[]): Agent[] {
  return agents.filter((agent) => agent.deletedAt === null && !channel.memberIds.includes(agent.id));
}

/** ヘッダーの作業中の表示（docs/ui-design.md §5.3）: 「ハル、ギア が作業中 · 待機 2」「ハル ほか 2 人が作業中」 */
export function workingSummary(names: readonly string[], pending: number): string {
  const parts: string[] = [];
  if (names.length >= 3) parts.push(t('workingMany', { name: names[0] ?? '', count: names.length - 1 }));
  else if (names.length > 0)
    parts.push(t('workingFew', { names: names.join(t('nameSeparator')), count: names.length }));
  if (pending > 0) parts.push(t('waiting', { count: pending }));
  return parts.join(' · ');
}

export interface ChannelDraft {
  name: string;
  topic: string;
  /** 絵文字1つ（空なら # を出す） */
  icon: string;
  memberIds: string[];
  workspaceMode: WorkspaceMode;
  /** workspaceMode が folder のときだけ使う */
  workspaceFolder: string;
}

export type ChannelField = 'name' | 'topic' | 'icon' | 'workspaceFolder';

/** 名前の先頭の # は付けなくてよい（付けても外す。全角の ＃ も） */
export { cleanChannelName };

/** 保存で返った validation の field（CommandError.field）がどの入力のことか（分からなければ null） */
export function channelErrorField(field: string | null): ChannelField | null {
  return field === 'name' || field === 'topic' || field === 'icon' || field === 'workspaceFolder' ? field : null;
}

export function validateChannelDraft(draft: ChannelDraft): Partial<Record<ChannelField, string>> {
  const entries: Array<[ChannelField, string | null]> = [
    [
      'name',
      checkText(cleanChannelName(draft.name), { label: t('channelName'), required: true, max: CHANNEL_NAME_MAX }),
    ],
    ['topic', checkText(draft.topic, { label: t('topicLabel'), max: CHANNEL_TOPIC_MAX })],
    ['icon', normalizeChannelIcon(draft.icon) === null ? tIcon('invalid') : null],
    [
      'workspaceFolder',
      draft.workspaceMode === 'folder' && !/^(?:\/|[A-Za-z]:[\\/])/.test(draft.workspaceFolder.trim())
        ? t('folderRequired')
        : null,
    ],
  ];
  return Object.fromEntries(entries.filter((entry): entry is [ChannelField, string] => entry[1] !== null));
}

/**
 * 指定フォルダのチャンネルで、どのバックエンドが何を使えるかの案内。バックエンドの申告（folderScope）から作る
 * （名前を決め打ちしないので、バックエンドが増えても直さなくてよい）
 */
export function folderScopeHint(backends: readonly BackendInfo[]): string {
  const labels = (scope: FolderScope | null): string =>
    backends
      .filter((backend) => backend.folderScope === scope)
      .map((backend) => backend.label)
      .join(t('backendSeparator'));
  const lines: Array<[string, 'folderFiles' | 'folderSandbox' | 'folderNone']> = [
    [labels('files'), 'folderFiles'],
    [labels('sandbox'), 'folderSandbox'],
    [labels(null), 'folderNone'],
  ];
  return [
    t('folderIntro'),
    ...lines.filter(([names]) => names !== '').map(([names, key]) => t(key, { names })),
    t('folderIsolation'),
  ].join(t('sentenceSeparator'));
}
