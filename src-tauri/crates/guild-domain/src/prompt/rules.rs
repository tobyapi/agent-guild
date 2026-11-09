//! 全員共通: 場所（チャンネル・現在日時・メンバー）とメンション・出力のルール。

use super::{members, PromptContext};

pub(super) fn section(ctx: &PromptContext<'_>) -> String {
    let topic = ctx.channel.topic.trim();
    let topic = if topic.is_empty() {
        String::new()
    } else {
        format!("\nチャンネルの話題: {topic}")
    };
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
",
        channel = ctx.channel.name,
        now = ctx.now_label,
        members = members::member_list(ctx),
        me = ctx.me.name,
        name = ctx.agent.name,
    )
}
