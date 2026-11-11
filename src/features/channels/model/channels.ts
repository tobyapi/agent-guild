// チャンネルまわりの純粋なロジック。
import { CHANNEL_NAME_MAX, CHANNEL_TOPIC_MAX, cleanChannelName } from '@/shared/lib/limits';
import { groupByPrimaryTag } from '@/features/agents';
import type { TagGroup } from '@/features/agents';
import { checkText } from '@/shared/lib/validation';
import type { Agent, AgentTemplate, Channel } from '@/shared/types/domain';

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
  if (names.length >= 3) parts.push(`${names[0] ?? ''} ほか ${names.length - 1} 人が作業中`);
  else if (names.length > 0) parts.push(`${names.join('、')} が作業中`);
  if (pending > 0) parts.push(`待機 ${pending}`);
  return parts.join(' · ');
}

export interface ChannelDraft {
  name: string;
  topic: string;
  memberIds: string[];
  workspaceMode?: 'legacy' | 'folder' | 'global';
  workspaceFolder?: string;
}

export type ChannelField = 'name' | 'topic' | 'workspaceFolder';

/** 名前の先頭の # は付けなくてよい（付けても外す。全角の ＃ も） */
export { cleanChannelName };

/** 保存で返った validation の field（CommandError.field）がどの入力のことか（分からなければ null） */
export function channelErrorField(field: string | null): ChannelField | null {
  return field === 'name' || field === 'topic' || field === 'workspaceFolder' ? field : null;
}

export function validateChannelDraft(draft: ChannelDraft): Partial<Record<ChannelField, string>> {
  const entries: Array<[ChannelField, string | null]> = [
    ['name', checkText(cleanChannelName(draft.name), { label: 'チャンネル名', required: true, max: CHANNEL_NAME_MAX })],
    ['topic', checkText(draft.topic, { label: '話題', max: CHANNEL_TOPIC_MAX })],
    [
      'workspaceFolder',
      draft.workspaceMode === 'folder' && !/^(?:\/|[A-Za-z]:[\\/])/.test((draft.workspaceFolder ?? '').trim())
        ? '作業フォルダの絶対パスを入力してください'
        : null,
    ],
  ];
  return Object.fromEntries(entries.filter((entry): entry is [ChannelField, string] => entry[1] !== null));
}
