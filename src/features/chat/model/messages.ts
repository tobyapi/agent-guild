// 発言の一覧の扱い（docs/design.md §4: id で冪等に追加し、seq で並べる）。
import { parseMentions } from '@/shared/lib/mentions';
import { HUMAN_ID } from '@/shared/types/domain';
import type { Message } from '@/shared/types/domain';

/**
 * 発言を合わせる。send_message の戻り値と message-created の両方で同じ発言が届いてもよい。
 * いちばん多い「最新の1件が届いた」場合は並べ直さずに末尾へ足す。
 */
export function mergeMessages(current: readonly Message[], incoming: readonly Message[]): Message[] {
  const [single] = incoming;
  const last = current.at(-1);
  if (incoming.length === 1 && single && (!last || single.seq > last.seq)) return [...current, single];
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.seq - b.seq);
}

/** 本文で人間（自分）が呼ばれているか（自分宛ての発言の行を目立たせる） */
export function mentionsHuman(message: Message, myName: string): boolean {
  if (message.authorId === HUMAN_ID || myName === '') return false;
  return parseMentions(message.content, [{ id: HUMAN_ID, name: myName }]).length > 0;
}
