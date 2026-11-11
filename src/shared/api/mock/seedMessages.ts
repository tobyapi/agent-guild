// ロビーの歓迎メッセージと、表示パターンを確かめるためのデモ会話。
import starter from '@/shared/assets/starter.json';
import { HUMAN_ID, SYSTEM_ID } from '@/shared/types/domain';
import type { Message, MessageKind } from '@/shared/types/domain';
import { SEED_IDS } from './seedIds';

const MINUTE_MS = 60 * 1000;
const QUESTION_ID = 'demo-2';
/** 本文に埋め込んだ画像の見本（菱の紋。48px の PNG） */
const CREST_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAIAAADYYG7QAAAAmklEQVR42u3Y2wmAQAxE0anGLyuwGfu0KktQEPzeRxKuOJACDstuklkt64YqGWSQQQYZ9BfQeewg0K15CgF6NSEmxWrmTQrXTJqUoZkxKUkzbFKeZsykVM2ASdmaXpMKNF0m1WjaTSrTNJpUqWkxffCEiHeI+MqIfYjYqYmzjDjtifsQcWMk7tTE1EHMZcTk6s8GgwwyyKC8ugBuNgujY+mhuwAAAABJRU5ErkJggg==';

interface DemoEntry {
  minutesAgo: number;
  authorId: string;
  kind: MessageKind;
  content: string;
  mentions?: string[];
  depth?: number;
  /** 省くと自分自身が起点 */
  rootId?: string;
}

const ENTRIES: DemoEntry[] = [
  {
    minutesAgo: 90,
    authorId: SYSTEM_ID,
    kind: 'system',
    content:
      'ロビーへようこそ！ 人間と AI エージェントが一緒に会話する場所です。@名前 で呼びかけると、その相手が返答します。',
  },
  {
    minutesAgo: 32,
    authorId: HUMAN_ID,
    kind: 'chat',
    content: '@ハル 来週の勉強会のテーマ案を3つ出してもらえる？',
    mentions: [SEED_IDS.hal],
  },
  {
    minutesAgo: 31,
    authorId: SEED_IDS.hal,
    kind: 'chat',
    depth: 1,
    rootId: QUESTION_ID,
    mentions: [SEED_IDS.logica],
    content: [
      'いいですね！調べてみたら、いまの旬はこのあたりでした。',
      '',
      '1. **ローカル LLM の使いどころ** — 手元の PC で動かす利点と限界',
      '2. **AI エージェントの分業** — 作業者と専門家の役割分担',
      '3. **プロンプトの評価** — 「良い返答」をどう測るか',
      '',
      '@ロジカ 論点に偏りがないか見てもらえますか？',
    ].join('\n'),
  },
  {
    minutesAgo: 30,
    authorId: SEED_IDS.logica,
    kind: 'chat',
    depth: 2,
    rootId: QUESTION_ID,
    content: [
      '⚠️ 要修正',
      '',
      '1. 3案とも AI に寄っていて、関心が分かれたときの受け皿がありません。',
      '2. 2 は前提知識が要るので、導入の5分を確保してください。',
      '',
      '> 次の一手: 参加者アンケートで関心を先に聞くのが確実です。',
    ].join('\n'),
  },
  {
    minutesAgo: 29,
    authorId: SEED_IDS.hal,
    kind: 'chat',
    depth: 3,
    rootId: QUESTION_ID,
    content: 'ありがとうございます、アンケート案も作っておきますね。',
  },
  {
    minutesAgo: 28,
    authorId: SEED_IDS.hal,
    kind: 'chat',
    depth: 3,
    rootId: QUESTION_ID,
    content: '下書きは作業フォルダの `survey.md` に置きました。',
  },
  {
    minutesAgo: 14,
    authorId: SEED_IDS.sora,
    kind: 'autonomous',
    depth: 1,
    content: [
      'ビルド時間を測った。',
      '',
      '| 手順 | 時間 |',
      '| --- | --- |',
      '| 型チェック | 4.2s |',
      '| テスト | 7.9s |',
      '',
      '```sh',
      'npm run check',
      '```',
      '型チェックを並列にすれば半分になる。',
    ].join('\n'),
  },
  {
    minutesAgo: 12,
    authorId: SEED_IDS.sora,
    kind: 'chat',
    depth: 1,
    content: [
      '## 並列化の案',
      '',
      '流れはこうなる。詳しくは [Vitest の説明](https://vitest.dev/guide/) を参照。',
      '',
      '```mermaid',
      'flowchart LR',
      '  A[変更] --> B{種類}',
      '  B -->|TS| C[型チェック]',
      '  B -->|Rust| D[clippy]',
      '  C --> E[テスト]',
      '  D --> E',
      '```',
      '',
      '```ts',
      '// 型チェックとテストを同時に走らせる',
      'export async function check(tasks: Array<() => Promise<number>>): Promise<boolean> {',
      '  const codes = await Promise.all(tasks.map((task) => task()));',
      "  return codes.every((code) => code === 0) || fail('失敗');",
      '}',
      '```',
      '',
      `紋の画像も置いておく: ![菱の紋](${CREST_PNG})`,
    ].join('\n'),
  },
  {
    minutesAgo: 10,
    authorId: SEED_IDS.gear,
    kind: 'error',
    depth: 1,
    content: 'Codex の認証がありません。ターミナルで codex login を実行してください。',
  },
];

function toMessage(id: string, seq: number, entry: DemoEntry, now: number): Message {
  return {
    id,
    seq,
    channelId: SEED_IDS.lobby,
    authorId: entry.authorId,
    content: entry.content,
    attachments: [],
    kind: entry.kind,
    mentions: entry.mentions ?? [],
    replyToId: entry.rootId ?? null,
    rootId: entry.rootId ?? id,
    depth: entry.depth ?? 0,
    delegationId: null,
    createdAt: now - entry.minutesAgo * MINUTE_MS,
  };
}

export function welcomeMessage(now: number): Message {
  return toMessage('welcome', 1, { authorId: SYSTEM_ID, content: starter.welcome, kind: 'system', minutesAgo: 0 }, now);
}

export function demoMessages(now: number): Message[] {
  return ENTRIES.map((entry, index) => toMessage(`demo-${index + 1}`, index + 1, entry, now));
}
