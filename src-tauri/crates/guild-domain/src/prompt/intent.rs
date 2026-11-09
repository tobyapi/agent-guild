//! 操作の確認に渡す、信頼できる依頼の情報（run の intent）。ランナーのアダプタが、外に影響する操作の前に小さいモデルで
//! 「依頼に沿っているか」を確かめるときの基準になる。入れるのは、この会話の人間の発言（起点と、人間からのきっかけ）と、
//! エージェントの役割・できることだけ。資料や仲間（エージェント）の発言は入れない（資料に紛れた指示が確かめる側に届かないように）。

use super::conversation::{quote, truncate};
use super::{capabilities, PromptContext};
use crate::author::Author;
use crate::conversation::JobSpec;
use crate::message::Message;

/// 人間の発言1件あたりの文字数の上限
pub const INTENT_CHAR_LIMIT: usize = 2000;
/// 入れる人間の発言の数の上限（新しい方から）
pub const INTENT_MESSAGE_LIMIT: usize = 5;

/// history は会話プロンプトと同じもの（seq の昇順）
pub fn build_intent(ctx: &PromptContext<'_>, history: &[Message], job: &JobSpec) -> String {
    let requests: Vec<String> = human_requests(history, job)
        .iter()
        .map(|message| quote(&truncate(&message.content, INTENT_CHAR_LIMIT)))
        .collect();
    let requests = if requests.is_empty() {
        "（この会話に人間からの依頼はありません。自分から動いているか、仲間から頼まれています）".to_owned()
    } else {
        requests.join("\n\n")
    };
    format!("# 人間の依頼\n{requests}\n\n# エージェント\n{}\n", agent_lines(ctx))
}

/// この会話（合流したジョブなら関わる会話すべて）の人間の発言。seq 順で、新しい方から INTENT_MESSAGE_LIMIT 件
fn human_requests<'a>(history: &'a [Message], job: &'a JobSpec) -> Vec<&'a Message> {
    let roots: Vec<_> = job.conversations().collect();
    let mut messages: Vec<&Message> = history
        .iter()
        .chain(&job.triggers)
        .filter(|message| message.author_id == Author::Human && roots.contains(&&message.root_id))
        .collect();
    messages.sort_by_key(|message| message.seq);
    messages.dedup_by(|a, b| a.id == b.id);
    let skip = messages.len().saturating_sub(INTENT_MESSAGE_LIMIT);
    messages.into_iter().skip(skip).collect()
}

/// 名前・役割・得意分野（空の項目は書かない）と、実効権限でできること
fn agent_lines(ctx: &PromptContext<'_>) -> String {
    let agent = ctx.agent;
    let fields = [("役割", agent.role.trim()), ("得意分野", agent.expertise.trim())];
    let mut lines = vec![format!("名前: {}", agent.name)];
    lines
        .extend(fields.iter().filter(|(_, value)| !value.is_empty()).map(|(label, value)| format!("{label}: {value}")));
    lines.push(capabilities::describe(&ctx.permissions));
    lines.join("\n")
}
