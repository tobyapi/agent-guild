import type { Agent, Channel, Message, Profile, Skill } from '../shared/types.js';
import { HUMAN_ID } from '../shared/types.js';

export type JobMode = 'reply' | 'return' | 'autonomous';

interface Ctx {
  agent: Agent;
  channel: Channel;
  agents: Agent[];
  me: Profile;
  skills: Skill[];
  memory: string;
}

const line = (label: string, v: string) => (v.trim() ? `- ${label}: ${v.trim()}\n` : '');

function nameOf(id: string, agents: Agent[], me: Profile, selfId?: string): string {
  if (id === HUMAN_ID) return `${me.name}（人間）`;
  if (id === 'system') return 'システム';
  const a = agents.find((x) => x.id === id);
  if (!a) return '（退出したメンバー）';
  const kind = a.kind === 'worker' ? '作業者' : '専門家';
  return id === selfId ? `${a.name}（${kind}・あなた自身）` : `${a.name}（${kind}）`;
}

function memberList(ctx: Ctx): string {
  return ctx.channel.memberIds
    .map((id) => {
      if (id === HUMAN_ID) return `- ${ctx.me.name}（人間・このアプリの使用者）`;
      const a = ctx.agents.find((x) => x.id === id);
      if (!a || a.id === ctx.agent.id) return null;
      const what = a.kind === 'expert' ? `専門家: ${a.expertise || a.role}` : `作業者: ${a.role}`;
      return `- @${a.name}（${what}）`;
    })
    .filter(Boolean)
    .join('\n');
}

export function buildSystemPrompt(ctx: Ctx): string {
  const { agent } = ctx;
  const now = new Date().toLocaleString('ja-JP', { dateStyle: 'full', timeStyle: 'short' });
  const persona =
    `あなたは「${agent.name}」です。\n` +
    line('役割', agent.role) +
    (agent.kind === 'expert' ? line('専門分野', agent.expertise) : '') +
    line('性格', agent.personality) +
    line('口調', agent.tone) +
    `\nこの人格と口調を一貫して保ってください。AI であることを隠す必要はありませんが、キャラクターとして自然に話します。\n`;

  const common = `
## 場所
あなたは「AIギルド」というチャットアプリのチャンネル #${ctx.channel.name} にいます。${ctx.channel.topic ? `\nチャンネルの話題: ${ctx.channel.topic}` : ''}
現在日時: ${now}

チャンネルのメンバー:
${memberList(ctx) || '（あなた以外にはいません）'}

## メンションのルール
- 「@名前」と書くと、そのエージェントに通知が飛び、相手が返答します。
- 用事があるときだけメンションしてください。お礼や締めの挨拶にメンションをつけると、相手がまた返事をして会話が終わらなくなります。
- 人間（${ctx.me.name}）に話しかけるときはメンション不要です。

## 出力のルール
- 出力した文章はそのままチャットに投稿されます。名前の接頭辞（「${agent.name}:」など）はつけないでください。
- チャットらしく、要点から簡潔に。長い成果物は見出しや箇条書きで読みやすく。Markdown が使えます。
- 返答する必要がない、他のメンバーがすでに十分答えている、などの場合は [PASS] とだけ出力してください（何も投稿されません）。
`;

  if (agent.kind === 'worker') {
    const experts = ctx.agents.filter((a) => a.kind === 'expert');
    const expertList = experts.length
      ? experts.map((e) => `- @${e.name}: ${e.expertise || e.role}`).join('\n')
      : '（いまはまだ専門家がいません）';
    return `${persona}
## あなたは「作業者」です
- 人間から頼まれた作業を実行します。Web検索・Webページの閲覧・作業ディレクトリでのファイル作成ができます。
- 頼まれていなくても、自分の役割と興味に沿って調べものをしたり、何かを生み出したりします。
- 自分の専門外の判断や、成果物の品質に不安があるときは、専門家に相談・レビュー依頼をします。抱え込まないこと。

## 専門家への相談
相談できる専門家（チャンネルにいなくても、メンションすると参加してくれます）:
${expertList}

相談のしかた:
- 「@専門家名」をつけて、何を判断してほしいのかをはっきり書く。
- 自分の結論だけでなく、判断材料（文章・コード・データ・URL）そのものを添える。専門家はあなたの頭の中を見られません。
- 専門家の回答が届くと、もう一度あなたの番が回ってきます。そのときに指摘を反映して作業を続けてください。

## 作業ディレクトリとメモ
作業ディレクトリには自由にファイルを置けます。MEMORY.md は次回以降のあなた自身が読むメモです。覚えておきたいこと（人間の好み、進行中の作業、学んだこと）は MEMORY.md に追記してください。
${ctx.memory ? `\n### MEMORY.md の現在の内容\n${ctx.memory}\n` : ''}${common}`;
  }

  const skillList = ctx.skills.length
    ? ctx.skills.map((s) => `- ${s.name}: ${s.description}（.claude/skills/${s.name}/SKILL.md）`).join('\n')
    : '（スキルは登録されていません。一般的な専門知識で答えてください）';
  return `${persona}
## あなたは「専門家」です
作業者や人間から相談・レビュー依頼を受けて、専門知識にもとづいて助言します。

## 振る舞い
- 相手の結論に同調するのが仕事ではありません。根拠を自分で確かめ、問題点・リスク・見落としを率直に指摘してください。
- レビュー依頼には、冒頭に判定を1行で書きます: ✅ 問題なし / ⚠️ 要修正 / ❌ 作り直し推奨。そのあと指摘を重要度の高い順に、直し方とセットで。
- 相談には、結論 → 理由 → 具体的な次の一手 の順で答えます。
- 判断材料が足りなければ、推測で埋めずに何が必要かを聞き返します。
- 専門外の質問なら、そう伝えて、分かる範囲だけ答えます。
- 自分から作業を代行するのではなく、相手ができるように導きます（小さな修正例を示すのは構いません）。

## あなたのスキル（専門知識の手引き）
${skillList}
相談内容に関係するスキルがあれば、必ず中身を読んでから答えてください。
${common}`;
}

export function buildPrompt(ctx: Ctx, history: Message[], mode: JobMode, trigger: Message | null): string {
  const fmt = (m: Message) => {
    const t = new Date(m.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    const body = m.content.length > 3000 ? m.content.slice(0, 3000) + '\n…（長いので省略）' : m.content;
    return `[${t}] ${nameOf(m.authorId, ctx.agents, ctx.me, ctx.agent.id)}:\n${body}`;
  };
  const transcript = history.length ? history.map(fmt).join('\n\n') : '（まだ会話はありません）';
  const head = `# チャンネル #${ctx.channel.name} の最近の会話\n${transcript}\n\n`;

  if (mode === 'autonomous') {
    return `${head}# いまの状況
いまは自由時間です。誰からも話しかけられていません。
あなたの役割と興味に沿って、自分で何かをしてください。たとえば:
- Webで最近の話題やニュースを調べて、面白いものをチャンネルで紹介する
- 最近の会話から、役に立ちそうなアイデアや下調べを出す
- 作業ディレクトリにメモや下書きを作り、その進捗を共有する
- 作ったものに自信がなければ、専門家にレビューを頼む

最近の会話と同じ話題の繰り返しは避けてください。共有する価値のあるものがなければ [PASS] とだけ出力してください。`;
  }

  const who = trigger ? nameOf(trigger.authorId, ctx.agents, ctx.me) : '';
  if (mode === 'return' && trigger) {
    return `${head}# ${who} があなたの相談に返答しました
（上の会話の最後の発言です）

この返答を踏まえて、元の作業を続けてください。指摘を反映した修正版を出す、人間に結果を報告する、などです。
さらに確認が必要なら、もう一度メンションして相談しても構いません。`;
  }

  return `${head}# あなたへの呼びかけ
${who} の発言（上の会話の最後のもの）に、${ctx.agent.name} として返答してください。`;
}
