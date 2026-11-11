//! チャンネル。

use serde::{Deserialize, Serialize};

use super::author::MemberId;
use super::error::{ensure_max_chars, ValidationError};
use super::ids::{AgentId, ChannelId};

/// チャンネル名の最大文字数
pub const CHANNEL_NAME_MAX_CHARS: usize = 40;
/// 話題の最大文字数
pub const CHANNEL_TOPIC_MAX_CHARS: usize = 200;

/// チャンネル（TS の Channel）
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Channel {
    #[serde(default)]
    pub workspace: ChannelWorkspace,
    pub id: ChannelId,
    pub name: String,
    pub topic: String,
    #[serde(default)]
    pub is_lobby: bool,
    /// 参加順。人間は常に入る
    pub member_ids: Vec<MemberId>,
    pub created_at: i64,
}

/// Human-controlled file scope. Every change starts a fresh memory/history epoch.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ChannelWorkspace {
    pub mode: WorkspaceMode,
    pub folder: Option<String>,
    pub revision: u64,
    pub after_seq: i64,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WorkspaceMode {
    #[default]
    Legacy,
    Folder,
    Global,
}

impl Channel {
    pub fn has_member(&self, member: &MemberId) -> bool {
        self.member_ids.contains(member)
    }

    pub fn has_agent(&self, id: &AgentId) -> bool {
        self.agent_ids().any(|member| member == id)
    }

    /// エージェントのメンバー（参加順）
    pub fn agent_ids(&self) -> impl Iterator<Item = &AgentId> {
        self.member_ids.iter().filter_map(MemberId::agent_id)
    }
}

/// チャンネル名を正規化する（前後の空白と先頭の # を除く）
pub fn normalize_channel_name(name: &str) -> Result<String, ValidationError> {
    let name = name.trim().trim_start_matches(['#', '＃']).trim();
    if name.is_empty() {
        return Err(ValidationError::on("name", "チャンネル名を入力してください"));
    }
    ensure_max_chars(name, CHANNEL_NAME_MAX_CHARS, "name", "チャンネル名は40文字以内にしてください")?;
    Ok(name.to_owned())
}

/// 話題を正規化する（前後の空白を除く）
pub fn normalize_channel_topic(topic: &str) -> Result<String, ValidationError> {
    let topic = topic.trim();
    ensure_max_chars(topic, CHANNEL_TOPIC_MAX_CHARS, "topic", "話題は200文字以内にしてください")?;
    Ok(topic.to_owned())
}

/// メンバー一覧を正規化する: 人間を先頭に必ず入れ、重複を除く（順序は保つ）
pub fn normalize_members(members: &[MemberId]) -> Vec<MemberId> {
    let mut result = vec![MemberId::Human];
    for member in members {
        if !result.contains(member) {
            result.push(member.clone());
        }
    }
    result
}
