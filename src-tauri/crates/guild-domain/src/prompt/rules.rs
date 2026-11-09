//! 全員共通: 場所（チャンネル・現在日時・メンバー）とメンション・出力・作業中の投稿のルール。

use super::{members, PromptContext};
use crate::backend::MidRunPost;

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

## 出力のルール
- 出力した文章はそのままチャットに投稿されます。名前の接頭辞（「{name}:」など）はつけないでください。
- チャットらしく、要点から簡潔に。長い成果物は見出しや箇条書きで読みやすく。Markdown が使えます。
- 返答する必要がない、他のメンバーがすでに十分答えている、などの場合は [PASS] とだけ出力してください（何も投稿されません）。
{posting}",
        channel = ctx.channel.name,
        now = ctx.now_label,
        members = members::member_list(ctx),
        me = ctx.me.name,
        name = ctx.agent.name,
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
