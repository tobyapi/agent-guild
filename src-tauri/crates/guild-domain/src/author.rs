//! 発言者（Author）とチャンネルのメンバー（MemberId）。
//! JSON では文字列: 人間は "me"、システムは "system"、エージェントはその ID。

use serde::{Deserialize, Serialize};

use super::ids::AgentId;

/// 人間（使用者）の ID。使用者は1人だけ
pub const HUMAN_ID: &str = "me";
/// システム発言の authorId
pub const SYSTEM_ID: &str = "system";

/// メッセージの発言者
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(from = "String", into = "String")]
pub enum Author {
    Human,
    System,
    Agent(AgentId),
}

impl Author {
    pub fn as_str(&self) -> &str {
        match self {
            Self::Human => HUMAN_ID,
            Self::System => SYSTEM_ID,
            Self::Agent(id) => id.as_str(),
        }
    }

    pub fn agent_id(&self) -> Option<&AgentId> {
        match self {
            Self::Agent(id) => Some(id),
            Self::Human | Self::System => None,
        }
    }
}

impl From<String> for Author {
    fn from(value: String) -> Self {
        match value.as_str() {
            HUMAN_ID => Self::Human,
            SYSTEM_ID => Self::System,
            _ => Self::Agent(AgentId::new(value)),
        }
    }
}

impl From<Author> for String {
    fn from(author: Author) -> Self {
        author.as_str().to_owned()
    }
}

/// チャンネルのメンバー
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(from = "String", into = "String")]
pub enum MemberId {
    Human,
    Agent(AgentId),
}

impl MemberId {
    pub fn as_str(&self) -> &str {
        match self {
            Self::Human => HUMAN_ID,
            Self::Agent(id) => id.as_str(),
        }
    }

    pub fn agent_id(&self) -> Option<&AgentId> {
        match self {
            Self::Agent(id) => Some(id),
            Self::Human => None,
        }
    }
}

impl From<String> for MemberId {
    fn from(value: String) -> Self {
        if value == HUMAN_ID {
            Self::Human
        } else {
            Self::Agent(AgentId::new(value))
        }
    }
}

impl From<MemberId> for String {
    fn from(member: MemberId) -> Self {
        member.as_str().to_owned()
    }
}
