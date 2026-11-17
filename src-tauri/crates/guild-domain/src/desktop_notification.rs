//! 最終返答の末尾にある明示的な notify ブロック。引用・説明中のコードは要求にしない。
pub const BODY_LIMIT: usize = 160;

#[derive(Debug, PartialEq, Eq)]
pub struct NotificationRequest {
    pub body: String,
}

/// 左端の完全一致フェンス、1行の本文、1返答1件。前には人間向けの返答と空行を必要とする。
pub fn extract(raw: &str) -> Option<(&str, NotificationRequest)> {
    let raw = raw.trim_end_matches(['\r', '\n', ' ']);
    let (head, close) = raw.rsplit_once('\n')?;
    if close.trim_end_matches('\r') != "```" {
        return None;
    }
    let (head, body) = head.rsplit_once('\n')?;
    let (text, open) = head.rsplit_once('\n')?;
    if open.trim_end_matches('\r') != "```notify"
        || text.trim().is_empty()
        || text.trim() == "[PASS]"
        || !text.rsplit('\n').next().is_some_and(|line| line.trim().is_empty())
        || text.lines().any(|line| line.trim_start().starts_with('<'))
        || !outside_fence(text)
    {
        return None;
    }
    let body = body.strip_suffix('\r').unwrap_or(body);
    if body.chars().any(char::is_control) {
        return None;
    }
    let body = body.trim();
    if body.is_empty() || body.chars().count() > BODY_LIMIT || body.starts_with("```") || body.starts_with("~~~") {
        return None;
    }
    Some((text.trim_end(), NotificationRequest { body: body.to_owned() }))
}

fn outside_fence(body: &str) -> bool {
    let mut fence: Option<(char, usize)> = None;
    for line in body.lines() {
        let line = line.trim_start_matches(' ');
        let Some(first) = line.chars().next().filter(|c| matches!(c, '`' | '~')) else { continue };
        let count = line.chars().take_while(|c| *c == first).count();
        if count < 3 {
            continue;
        }
        match fence {
            None if line == "```notify" => return false,
            None => fence = Some((first, count)),
            Some((marker, size)) if marker == first && count >= size && line[count..].trim().is_empty() => fence = None,
            _ => {}
        }
    }
    fence.is_none()
}
