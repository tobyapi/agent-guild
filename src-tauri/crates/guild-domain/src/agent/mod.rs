//! エージェントのモデル。権限は先頭タグに対応する役割の表から固定し、その他の振る舞いは本人の設定で決める。
//! テンプレート ID やタグの文字列をハードコードせず、役割表を共通のポリシーで引く（design.md §2）。

mod behavior;
mod model;
mod name;
mod permission_policy;
mod permissions;
mod tags;
mod template_model;
mod templates;
mod validation;

pub use behavior::Behavior;
pub use model::{Agent, AgentInput};
pub use name::{ensure_unique_name, name_key, normalize_name, NAME_MAX_CHARS};
pub use permission_policy::{role_permissions, usable_permissions};
pub use permissions::{effective_permissions, PermissionKey, Permissions};
pub use tags::{normalize_tags, TAG_MAX_CHARS, TAG_MAX_COUNT};
pub use template_model::{AgentTemplate, AgentTemplateDefaults};
pub use templates::{find_template, role_template, templates};
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
