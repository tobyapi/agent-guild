//! 人間（使用者）のプロフィール。名前はエージェント名と同じ規則で検証し、互いに重複させない。

use serde::{Deserialize, Serialize};

use super::agent::{normalize_name, AVATAR_MAX_BYTES};
use super::error::ValidationError;

/// TS の Profile
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub name: String,
    pub avatar: String,
    pub color: String,
}

impl Default for Profile {
    fn default() -> Self {
        Self {
            name: "ユーザー".to_owned(),
            avatar: "🙂".to_owned(),
            color: "#f0ba5f".to_owned(),
        }
    }
}

/// 名前を検証して前後の空白を除く（重複の確認はエージェント一覧と合わせて ensure_unique_name で行う）
pub fn normalize_profile(mut profile: Profile) -> Result<Profile, ValidationError> {
    profile.name = normalize_name(&profile.name)?;
    if profile.avatar.len() > AVATAR_MAX_BYTES {
        return Err(ValidationError::on("avatar", "アバター画像が大きすぎます（2MB まで）"));
    }
    Ok(profile)
}
