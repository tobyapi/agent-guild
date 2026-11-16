//! 投稿時に確定する申告と、直前の投稿以降の専用読込記録。使用の証明ではない。
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillUsage {
    pub declared: Vec<String>,
    pub loaded: Vec<String>,
    pub supported: bool,
    pub run_id: Option<String>,
    /// Older metadata has no interval. Do not invent provenance when reading it.
    #[serde(default)]
    pub interval: Option<SkillInterval>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillInterval {
    pub version: u8,
    pub agent_id: String,
    pub start: u64,
    pub end: u64,
    pub incomplete: bool,
    #[serde(default)]
    pub observations: Vec<SkillRead>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillRead {
    pub name: String,
    pub tool_call_id: String,
    /// Runner-issued order, not a model-provider sequence.
    pub sequence: u64,
}

pub fn valid_name(name: &str) -> bool {
    !name.is_empty()
        && name.chars().count() <= 120
        && name.chars().next().is_some_and(char::is_alphanumeric)
        && name.chars().all(|c| c.is_alphanumeric() || "._:/-".contains(c))
}

/// 裸の末尾フッタだけが自己申告。引用元を判定できないため観測記録へは決して昇格しない。
pub fn declaration(raw: &str) -> (String, Vec<String>) {
    let normalized = raw.replace("\r\n", "\n");
    let trimmed = normalized.trim_end();
    let lines: Vec<_> = trimmed.lines().collect();
    if lines.len() < 3 || lines[lines.len() - 3] != "```skill-usage" || lines[lines.len() - 1] != "```" {
        return (raw.to_owned(), Vec::new());
    }
    let prefix = &lines[..lines.len() - 3];
    let mut fence: Option<(char, usize)> = None;
    for line in prefix {
        let indent = line.len() - line.trim_start_matches(' ').len();
        if indent > 3 {
            continue;
        }
        let line = line.trim_start_matches(' ');
        let Some(marker) = line.chars().next().filter(|c| *c == '`' || *c == '~') else {
            continue;
        };
        let count = line.chars().take_while(|c| *c == marker).count();
        if count < 3 {
            continue;
        }
        match fence {
            None => fence = Some((marker, count)),
            Some((open, length)) if marker == open && count >= length && line[count..].trim().is_empty() => {
                fence = None
            }
            _ => {}
        }
    }
    let json = lines[lines.len() - 2];
    if fence.is_some() || json.len() > 4096 {
        return (raw.to_owned(), Vec::new());
    }
    let Ok(names) = serde_json::from_str::<Vec<String>>(json) else {
        return (raw.to_owned(), Vec::new());
    };
    if names.len() > 32 || !names.iter().all(|n| valid_name(n)) {
        return (raw.to_owned(), Vec::new());
    }
    let mut unique = Vec::new();
    for name in names {
        if !unique.contains(&name) {
            unique.push(name);
        }
    }
    (prefix.join("\n").trim_end().to_owned(), unique)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn older_metadata_without_interval_remains_readable() {
        let usage: SkillUsage =
            serde_json::from_str(r#"{"declared":[],"loaded":[],"supported":false,"runId":"old"}"#).unwrap();
        assert!(usage.interval.is_none());
        assert_eq!(usage.run_id.as_deref(), Some("old"));
    }
    #[test]
    fn declaration_boundaries_and_no_body_pass() {
        let footer = "```skill-usage\n[\"clean-code\",\"reflection\",\"clean-code\"]\n```";
        assert_eq!(declaration(footer), (String::new(), vec!["clean-code".into(), "reflection".into()]));
        assert_eq!(declaration(&format!("[PASS]\n{footer}")).0, "[PASS]");
        for raw in [
            format!("````text\n{footer}\n````"),
            format!("> {footer}"),
            footer.replace("skill-usage\n", "skill-usage \n"),
            footer.replace("clean-code", "<skill-name>"),
            format!("```text\n{footer}"),
        ] {
            assert!(declaration(&raw).1.is_empty(), "{raw}");
        }
        assert_eq!(declaration(&format!("body\r\n{}", footer.replace('\n', "\r\n"))).0, "body");
    }
}
