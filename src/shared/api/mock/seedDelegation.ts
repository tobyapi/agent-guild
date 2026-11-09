// 見た目の確認用の、終わった割り振りの見本（カナメが2人に割り振り、1人が報告・1人が回答なし → まとめ）。
import { HUMAN_ID } from '@/shared/types/domain';
import type { Delegation, Message } from '@/shared/types/domain';
import { SEED_IDS } from './seedIds';

const DELEGATION_ID = 'demo-delegation';
const REQUEST_ID = 'demo-task-request';

type DemoMessage = Pick<Message, 'id' | 'authorId' | 'content' | 'depth'> & { secondsAgo: number; delegationId?: string };

const MESSAGES: DemoMessage[] = [
  {
    id: REQUEST_ID,
    authorId: HUMAN_ID,
    depth: 0,
    secondsAgo: 380,
    content: '新しい社内ツールの名前を決めたいです。候補出しと、使う人の目線での確認をお願いします。',
  },
  {
    id: 'demo-task-plan',
    authorId: SEED_IDS.kaname,
    depth: 1,
    secondsAgo: 360,
    delegationId: DELEGATION_ID,
    content: [
      '2つに分けて進めます。',
      '',
      '```tasks',
      '@ハル: 社内ツールの名前の候補を5つ出して、それぞれの由来を一言で添えてください',
      '@ソラ: 候補を使う人の目線で見て、覚えやすさと誤解されにくさを確かめてください',
      '```',
    ].join('\n'),
  },
  {
    id: 'demo-task-hal',
    authorId: SEED_IDS.hal,
    depth: 2,
    secondsAgo: 290,
    content: '候補を5つ出しました！\n\n1. **ツナグ** — 人と情報をつなぐ\n2. **ミチシルベ** — 迷ったときの道しるべ\n3. **ヒカリ** — 必要なものがすぐ見つかる\n4. **ハコブネ** — みんなの知恵を運ぶ\n5. **コンパス** — 進む方向をそろえる',
  },
  {
    id: 'demo-task-summary',
    authorId: SEED_IDS.kaname,
    depth: 3,
    secondsAgo: 200,
    content: 'まとめます。\n\n- 名前の候補はハルが5つ出しました（ツナグ・ミチシルベ・ヒカリ・ハコブネ・コンパス）。\n- ソラからは回答がなかったので、使う人の目線の確認はまだです。\n\n次の一手: 候補を3つに絞ってから、ソラにもう一度確認を頼みます。',
  },
];

/** 割り振りの見本の発言（seq は firstSeq から）と、その割り振り */
export function demoDelegation(now: number, firstSeq: number): { messages: Message[]; delegation: Delegation } {
  const at = (secondsAgo: number) => now - secondsAgo * 1000;
  const messages = MESSAGES.map(
    ({ secondsAgo, delegationId, ...entry }, index): Message => ({
      ...entry,
      seq: firstSeq + index,
      channelId: SEED_IDS.lobby,
      attachments: [],
      kind: 'chat',
      mentions: [],
      replyToId: entry.id === REQUEST_ID ? null : REQUEST_ID,
      rootId: REQUEST_ID,
      delegationId: delegationId ?? null,
      createdAt: at(secondsAgo),
    }),
  );
  const delegation: Delegation = {
    id: DELEGATION_ID,
    channelId: SEED_IDS.lobby,
    managerId: SEED_IDS.kaname,
    messageId: 'demo-task-plan',
    status: 'done',
    subtasks: [
      { id: 'demo-subtask-1', assigneeId: SEED_IDS.hal, instruction: '社内ツールの名前の候補を5つ出して、それぞれの由来を一言で添えてください', status: 'done', resultMessageId: 'demo-task-hal', note: null },
      { id: 'demo-subtask-2', assigneeId: SEED_IDS.sora, instruction: '候補を使う人の目線で見て、覚えやすさと誤解されにくさを確かめてください', status: 'failed', resultMessageId: null, note: '回答がありませんでした' },
    ],
    summaryMessageId: 'demo-task-summary',
    createdAt: at(360),
    updatedAt: at(200),
  };
  return { messages, delegation };
}
