// 自発活動の設定（docs/design.md §10）。
import { AUTONOMY_INTERVAL_MIN } from '@/shared/lib/limits';
import type { Channel } from '@/shared/types/domain';
import { tBrain } from '../i18n/brain';

/** 新しく作るときの間隔（分） */
export const DEFAULT_INTERVAL_MIN = 60;

export interface ChannelChoice {
  id: string;
  name: string;
}

/** 投稿先の候補: そのエージェントが参加しているチャンネル（新規作成中はまだどこにもいない） */
export function autonomyChannelChoices(
  channels: ReadonlyArray<Pick<Channel, 'id' | 'name' | 'memberIds'>>,
  agentId: string | null,
): ChannelChoice[] {
  if (agentId === null) return [];
  return channels.filter((channel) => channel.memberIds.includes(agentId)).map(({ id, name }) => ({ id, name }));
}

/** 間隔（分）の入力を数にする。整数でなければ null */
export function parseIntervalMin(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

export function checkIntervalMin(text: string): string | null {
  const minutes = parseIntervalMin(text);
  if (minutes === null) return tBrain('intervalNotNumber');
  return minutes < AUTONOMY_INTERVAL_MIN ? tBrain('intervalTooShort', { min: AUTONOMY_INTERVAL_MIN }) : null;
}
