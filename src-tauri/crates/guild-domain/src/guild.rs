//! ギルドのプロフィール（名前と紋）。ギルドのデータなので、データフォルダの DB（meta 表）に JSON で保存する。

use serde::{Deserialize, Serialize};
use serde_json::Value;

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

/// 保存値を読む。未保存・JSON でない値は既定。項目ごとに読み、読めない項目
/// （新しい版が足した形や色・長すぎる名前）だけを既定にする（ほかの項目は失わない）
pub fn read_stored_guild(raw: Option<&str>) -> GuildProfile {
    let Some(value) = raw.and_then(|raw| serde_json::from_str::<Value>(raw).ok()) else {
        return GuildProfile::default();
    };
    let name = value.get("name").and_then(Value::as_str).unwrap_or_default();
    let name = normalize_guild(GuildProfile { name: name.to_owned(), ..GuildProfile::default() })
        .map(|guild| guild.name)
        .unwrap_or_default();
    let crest = value.get("crest");
    GuildProfile { name, crest: GuildCrest { shape: field(crest, "shape"), color: field(crest, "color") } }
}

fn field<T: serde::de::DeserializeOwned + Default>(crest: Option<&Value>, key: &str) -> T {
    crest.and_then(|crest| crest.get(key)).and_then(|value| T::deserialize(value).ok()).unwrap_or_default()
}
