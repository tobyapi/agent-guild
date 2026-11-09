//! ランナーが返した文章をチャットに投稿する形に整える（design.md §7-4）。

/// 「返答しない」ことを表す出力
pub const PASS_TOKEN: &str = "[PASS]";

/// 投稿する本文を返す。前後の空白を除き、先頭の「{名前}:」「{名前}：」を除いて、
/// 残りが空か `[PASS]` だけなら None（投稿しない）。文中の `[PASS]` は取り除いて残りを投稿する。
pub fn format_reply(raw: &str, agent_name: &str) -> Option<String> {
    let body = strip_name_prefix(raw.trim(), agent_name).trim();
    if body.is_empty() || body == PASS_TOKEN {
        return None;
    }
    let body = body.replace(PASS_TOKEN, "");
    let body = body.trim();
    if body.is_empty() {
        None
    } else {
        Some(body.to_owned())
    }
}

fn strip_name_prefix<'a>(text: &'a str, agent_name: &str) -> &'a str {
    if agent_name.is_empty() {
        return text;
    }
    text.strip_prefix(agent_name)
        .and_then(|rest| rest.strip_prefix(':').or_else(|| rest.strip_prefix('：')))
        .unwrap_or(text)
}
