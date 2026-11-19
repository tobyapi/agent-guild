//! ギルドのプロフィール（名前と紋）と、名前の入力規則。

use serde::{Deserialize, Serialize};

use super::error::{ensure_max_chars, ValidationError};
use super::locale;

/// ギルド名の最大文字数（エージェント名と同じ）
pub const GUILD_NAME_MAX_CHARS: usize = 32;

/// TS の GuildProfile。name が空なら、画面は表示言語のアプリ名（AIギルド）を出す
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GuildProfile {
    pub name: String,
    pub crest: GuildCrest,
}

/// TS の GuildCrest（紋の形と色。どちらも決まった候補から選ぶ）
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GuildCrest {
    pub shape: CrestShape,
    pub color: CrestColor,
}

/// 紋の形（TS の CrestShape）。既定は菱
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CrestShape {
    #[default]
    Diamond,
    Shield,
    Circle,
    Hexagon,
    Star,
}

/// 紋の色（TS の CrestColor）。default は文字の色（これまでの見た目）。色の値は React のトークンが決める
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CrestColor {
    #[default]
    Default,
    Gold,
    Crimson,
    Jade,
    Azure,
    Violet,
}

/// 名前の前後の空白を除き、長さを検証する（空はアプリ名を使う印なので許す）
pub fn normalize_guild(mut guild: GuildProfile) -> Result<GuildProfile, ValidationError> {
    let name = guild.name.trim();
    ensure_max_chars(
        name,
        GUILD_NAME_MAX_CHARS,
        "name",
        locale::pick([
            "ギルド名は32文字以内にしてください",
            "Guild names can be up to 32 characters",
            "公会名称不能超过 32 个字符",
            "公會名稱不能超過 32 個字元",
            "길드 이름은 32자 이내로 입력하십시오",
        ]),
    )?;
    guild.name = name.to_owned();
    Ok(guild)
}
