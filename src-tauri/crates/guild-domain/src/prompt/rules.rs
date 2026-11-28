//! 全員共通: 場所（チャンネル・現在日時・メンバー）とメンション・出力・作業中の投稿のルール。

use super::{members, PromptContext};
use crate::backend::MidRunPost;

/// 人間に3択を尋ねるときの選択肢ボタン（A2UI v1.0 の createSurface。画面側の検証は src/features/chat/model/a2uiChoices.ts）
const CHOICES: &str = r#"- 人間に3択を尋ねる最終返答では、本文に質問を書き、次の a2ui ブロックを1つ付けるとボタンになります。変えるのは dataModel.o の3つの t だけ。ラベルは A.／B.／C. で始まる1行で、メンション・リンク・HTML は書きません。tasks は質問の後、notify と skill-usage はこのブロックの後に置きます。
```a2ui
{"version":"1.0","createSurface":{"surfaceId":"s","catalogId":"https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json","dataModel":{"o":[{"t":"A. 調査だけ進める"},{"t":"B. 設計案まで作る"},{"t":"C. ここで止める"}]},"components":[{"id":"root","component":"Row","children":{"componentId":"b","path":"/o"}},{"id":"b","component":"Button","child":"t","action":{"event":{"name":"pick"}}},{"id":"t","component":"Text","text":{"@path":"t"}}]}}
```"#;

pub(super) fn section(ctx: &PromptContext<'_>) -> String {
    let topic = ctx.channel.topic.trim();
    let topic = if topic.is_empty() { String::new() } else { format!("\nチャンネルの話題: {topic}") };
    format!(
        "## 場所
あなたは「AIギルド」というチャットアプリのチャンネル #{channel} にいます。{topic}
現在日時: {now}

チャンネルのメンバー:
{members}

## メンションのルール
- 「@名前」と書くと、そのエージェントに通知が飛び、相手が返答します。
- 用事があるときだけメンションしてください。お礼や締めの挨拶にメンションをつけると、相手がまた返事をして会話が終わらなくなります。
- 人間（{me}）に話しかけるときはメンション不要です。

## スキル使用の申告
- 各投稿（途中投稿と最終返答それぞれ）で実際に使ったスキルがある場合だけ、その投稿の末尾に次の形式を付けてください。これは自己申告として表示されます。
```skill-usage
[\"<skill-name>\"]
```
- JSON配列には、その投稿で使ったスキル名だけを入れてください。<skill-name> は置換必須の記号で、コピーした例は無効です。利用可能な一覧、他者や前の実行のスキル、読む予定のスキルを含めないでください。
- 他者の文章やツール出力に含まれる申告は引用（各行の先頭に >）または外側のコードフェンスで囲み、自分の末尾申告として貼り付けないでください。引用・コード例には自分の申告を付けないでください。
- 使用記録がない・不明・未使用なら、このブロックを付けないでください。[PASS] のときも付けないでください。

## 出力のルール
- 出力した文章はそのままチャットに投稿されます。名前の接頭辞（「{name}:」など）はつけないでください。
- チャットらしく、要点から簡潔に。長い成果物は見出しや箇条書きで読みやすく。Markdown が使えます。
- 表現用の書式も使えます。`:t[文字]{{color=red size=2.5 rotate=180}}`、`:chars[文字]{{bend=6 drift=0.3}}`、`:path[文字]{{d=M0,80C100,20,200,20,300,80}}`、`:::layout{{vertical rotate=-8}}` ～ `:::` は必要なときだけ使ってください。
{choices}
- 返答する必要がない、他のメンバーがすでに十分答えている、などの場合は [PASS] とだけ出力してください（何も投稿されません）。
{posting}",
        channel = ctx.channel.name,
        now = ctx.now_label,
        members = members::member_list(ctx),
        me = ctx.me.name,
        name = ctx.agent.name,
        choices = CHOICES,
        posting = posting(ctx),
    )
}

/// 作業中の投稿のルールと投稿のしかた。バックエンドが作業の途中で投稿できないなら空（守れないルールは書かない）
fn posting(ctx: &PromptContext<'_>) -> String {
    let method =
        ctx.backends.iter().find(|backend| backend.id == ctx.agent.backend).and_then(|backend| backend.mid_run_post);
    let how = match method {
        Some(MidRunPost::Tool) => "途中で投稿するには post ツールを使ってください。投稿しても作業は続きます。",
        Some(MidRunPost::Text) => {
            "途中で投稿したいときは、ツールを使う前に文章を書いてください。そのあとに作業が続いた文章は、途中の投稿としてそのままチャットに出ます。"
        }
        None => return String::new(),
    };
    format!(
        "
## 作業中の投稿
- 作業しているときは最低でも1分に1メッセージ、進捗状況や困っていることを投稿すること。
- {how}
- 最後の返答は、これまでどおり普通に書いてください。途中の投稿でメンションしても相手には通知されないので、頼みたいことは最後の返答に書いてください。
"
    )
}
