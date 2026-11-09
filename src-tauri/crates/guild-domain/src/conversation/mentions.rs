//! メンション解析（design.md §8）。
//! 本文と名前を NFKC＋大文字小文字無視で正規化して照合し（全角の「＠」も「@」になる）、``` のコードブロックは無視する。
//! 名前の長い順に `@名前` を探し、見つけたら取り除いてから次を探す（「@ハルカ」が「@ハル」に誤爆しない）。

use std::cmp::Reverse;

use crate::agent::{name_key, Agent};
use crate::ids::AgentId;

const FENCE: &str = "```";

/// 本文で呼びかけられた（削除されていない）エージェントを、本文に現れた順に重複なく返す
pub fn parse_mentions(content: &str, agents: &[Agent]) -> Vec<AgentId> {
    let mut text = strip_code_blocks(&name_key(content));
    let mut candidates: Vec<(String, &AgentId)> = agents
        .iter()
        .filter(|agent| agent.is_active())
        .map(|agent| (name_key(&agent.name), &agent.id))
        .filter(|(key, _)| !key.is_empty())
        .collect();
    candidates.sort_by_key(|(key, _)| Reverse(key.chars().count()));

    let mut found: Vec<(usize, AgentId)> = Vec::new();
    for (key, id) in candidates {
        let needle = format!("@{key}");
        if let Some(position) = text.find(&needle) {
            found.push((position, id.clone()));
            // 同じ長さの空白で置き換えて、ほかの候補の位置を変えずに取り除く
            text = text.replace(&needle, &" ".repeat(needle.len()));
        }
    }
    found.sort_by_key(|(position, _)| *position);
    found.into_iter().map(|(_, id)| id).collect()
}

/// バッククォート3つ（FENCE）で囲まれた部分を除く（閉じていなければ最後までコードとみなす）
fn strip_code_blocks(text: &str) -> String {
    text.split(FENCE).step_by(2).collect::<Vec<_>>().join("\n")
}
