//! チャンネル。

use serde::{Deserialize, Serialize};

use super::author::MemberId;
use super::error::{ensure_max_chars, ValidationError};
use super::ids::{AgentId, ChannelId};
use crate::locale;

mod icon;
pub use icon::{normalize_channel_icon, CHANNEL_ICON_MAX_BYTES};

/// チャンネル名の最大文字数
pub const CHANNEL_NAME_MAX_CHARS: usize = 40;
/// 話題の最大文字数
pub const CHANNEL_TOPIC_MAX_CHARS: usize = 200;

/// チャンネル（TS の Channel）
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Channel {
    /// These bounds only affect runner history and admission of jobs for old roots.
    #[serde(skip)]
    pub history_after_seq: i64,
    #[serde(skip)]
    pub guard_old_roots: bool,
    pub id: ChannelId,
    pub name: String,
    pub topic: String,
    /// 絵文字1つ。空なら画面は # を出す（normalize_channel_icon。0002 の移行で足した列。既定は空）
    pub icon: String,
    /// 最初からあるロビー（消せない）
    pub is_lobby: bool,
    /// 参加順。人間は常に入る
    pub member_ids: Vec<MemberId>,
    pub created_at: i64,
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
        return Err(ValidationError::on(
            "name",
            locale::pick([
                "チャンネル名を入力してください",
                "Enter a channel name",
                "请输入频道名称",
                "請輸入頻道名稱",
                "채널 이름을 입력하십시오",
            ]),
        ));
    }
    ensure_max_chars(
        name,
        CHANNEL_NAME_MAX_CHARS,
        "name",
        locale::pick([
            "チャンネル名は40文字以内にしてください",
            "Channel names can be up to 40 characters",
            "频道名称不能超过 40 个字符",
            "頻道名稱不能超過 40 個字元",
            "채널 이름은 40자 이내로 입력하십시오",
        ]),
    )?;
    Ok(name.to_owned())
}

/// 話題を正規化する（前後の空白を除く）
pub fn normalize_channel_topic(topic: &str) -> Result<String, ValidationError> {
    let topic = topic.trim();
    ensure_max_chars(
        topic,
        CHANNEL_TOPIC_MAX_CHARS,
        "topic",
        locale::pick([
            "話題は200文字以内にしてください",
            "The topic can be up to 200 characters",
            "话题不能超过 200 个字符",
            "話題不能超過 200 個字元",
            "주제는 200자 이내로 입력하십시오",
        ]),
    )?;
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
