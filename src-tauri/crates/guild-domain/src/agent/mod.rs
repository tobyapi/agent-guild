//! エージェントのモデル。「種別」はなく、振る舞いは本人の設定（permissions・unmentioned・consultable・
//! canDelegate・autonomyEnabled）で決まる。タグは表示と絞り込みだけに使い、振る舞いを分岐しない（design.md §2）。

mod behavior;
mod model;
mod name;
mod permissions;
mod tags;
mod template_model;
mod templates;
mod validation;

pub use behavior::Behavior;
pub use model::{Agent, AgentInput};
pub use name::{ensure_unique_name, name_key, normalize_name, NAME_MAX_CHARS};
pub use permissions::{effective_permissions, PermissionKey, Permissions};
pub use tags::{normalize_tags, TAG_MAX_CHARS, TAG_MAX_COUNT};
pub use template_model::{AgentTemplate, AgentTemplateDefaults};
pub use templates::{find_template, templates};
pub use validation::{normalize_agent_input, AUTONOMY_INTERVAL_MIN, AVATAR_MAX_BYTES};

use serde::{Deserialize, Serialize};

/// メンションのない人間の発言への反応（TS の UnmentionedPolicy）。上の段に ready な該当者がいれば、下の段は答えない
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum UnmentionedPolicy {
    /// 最初に受ける（lead がいれば、メンションのない依頼は lead だけが受ける）
    Lead,
    /// 答える（lead がいなければ、チャンネルにいる answer の全員が順に答える）
    Answer,
    /// lead も answer もいないときだけ答える
    Fallback,
    /// 答えない（メンションされたときだけ話す）
    Ignore,
}

impl UnmentionedPolicy {
    /// 保存で使う識別子
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Lead => "lead",
            Self::Answer => "answer",
            Self::Fallback => "fallback",
            Self::Ignore => "ignore",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "lead" => Some(Self::Lead),
            "answer" => Some(Self::Answer),
            "fallback" => Some(Self::Fallback),
            "ignore" => Some(Self::Ignore),
            _ => None,
        }
    }
}
