// メッセージ一覧を画面の並び（日付の区切り・システム発言・同じ人の連続投稿のまとまり）に組み立てる。
// まとめる条件（docs/ui-design.md §5.4）: 同じ発言者・どちらも chat・5 分以内・同じ日。
// 自発投稿とエラー発言は札を見せるため、必ず新しいまとまりを始める。
import { isSameDay } from '@/shared/lib/time';
import type { Message, MessageKind } from '@/shared/types/domain';

/** 同じ人の連続投稿をひとまとめにする間隔 */
export const GROUP_WINDOW_MS = 5 * 60 * 1000;

export type TimelineItem =
  | { type: 'day'; key: string; at: number }
  | { type: 'system'; key: string; message: Message }
  | { type: 'group'; key: string; authorId: string; kind: MessageKind; messages: Message[] };

type GroupItem = Extract<TimelineItem, { type: 'group' }>;

function continuesGroup(group: GroupItem, message: Message): boolean {
  const tail = group.messages.at(-1);
  if (!tail || group.kind !== 'chat' || message.kind !== 'chat' || group.authorId !== message.authorId) return false;
  return isSameDay(tail.createdAt, message.createdAt) && message.createdAt - tail.createdAt <= GROUP_WINDOW_MS;
}

/** messages は表示順（seq の昇順）で渡す。breaksGroup が真の発言は、見出しを出すために必ず新しいまとまりを始める */
export function buildTimeline(messages: readonly Message[], breaksGroup: (message: Message) => boolean = () => false): TimelineItem[] {
  const items: TimelineItem[] = [];
  let previous: Message | undefined;
  for (const message of messages) {
    if (!previous || !isSameDay(previous.createdAt, message.createdAt)) {
      items.push({ type: 'day', key: `day-${message.id}`, at: message.createdAt });
    }
    const last = items.at(-1);
    if (message.kind === 'system') {
      items.push({ type: 'system', key: message.id, message });
    } else if (last?.type === 'group' && continuesGroup(last, message) && !breaksGroup(message)) {
      last.messages.push(message);
    } else {
      items.push({ type: 'group', key: message.id, authorId: message.authorId, kind: message.kind, messages: [message] });
    }
    previous = message;
  }
  return items;
}
