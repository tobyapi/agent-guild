//! アバターの枠（エージェントと人間のアイコンに重ねる飾り）。
//! 内蔵の枠の絵は React が持ち、ここでは ID の形だけを決める（`builtin:<名前>`）。生成した枠（`custom:<ID>`）は
//! ギルドのデータとして DB に置く。いまの生成は画像（PNG。内蔵スキル `ornate-avatar-frame` をそのまま渡して描いてもらい
//! （`prompt`）、`image` の決まりで検査して整え、データフォルダに置く）。
//! 以前の版は SVG を生成していた: その枠は `svg` で許可した要素と属性だけに作り直したものが DB に残っている。

mod image;
mod prompt;
mod svg;

use serde::{Deserialize, Serialize};

pub use image::{
    FrameImageProblem, FRAME_IMAGE_MAX_SIDE, FRAME_OPENING_INSET, FRAME_OPENING_RADIUS, FRAME_SOURCE_MAX_BYTES,
    FRAME_SOURCE_MAX_SIDE, FRAME_SOURCE_MIN_SIDE, FRAME_VIEWBOX,
};
pub use prompt::{frame_prompt, FRAME_SKILL_NAME};
pub use svg::{extract_svg, sanitize_frame_svg, SvgProblem, FRAME_SVG_MAX_BYTES};

use crate::error::{ensure_max_chars, ValidationError};
use crate::locale;

/// 内蔵の枠の ID の頭
pub const BUILTIN_PREFIX: &str = "builtin:";
/// 生成した枠の ID の頭
pub const CUSTOM_PREFIX: &str = "custom:";
/// 枠の名前の最大文字数
pub const FRAME_NAME_MAX_CHARS: usize = 24;
/// 生成を頼むときの説明の最大文字数
pub const FRAME_DESCRIPTION_MAX_CHARS: usize = 200;

/// TS の CustomFrame（生成した枠）。絵の種類は `kind`（`svg` か `png`）
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomFrame {
    pub id: String,
    pub name: String,
    #[serde(flatten)]
    pub art: FrameArt,
    pub created_at: i64,
}

/// 生成した枠の絵
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum FrameArt {
    /// 検査して作り直した SVG（以前の版が生成した枠。DB に置く）
    Svg { svg: String },
    /// 検査して整えた PNG（データフォルダの frames/ に置く。中身は Snapshot に載せず、get_frame_image で取る）
    Png,
}

/// 生成した枠の ID（`custom:` + 生成した ID）
pub fn custom_frame_id(generated: &str) -> String {
    format!("{CUSTOM_PREFIX}{generated}")
}

/// メンバーが選んだ枠の ID を確かめる。空は「なし」。`builtin:` と `custom:` の後ろは英数字とハイフンだけ。
/// 知らない内蔵の枠や消えた生成の枠は保存してよい（画面は枠なしで描く）
pub fn normalize_frame_id(raw: &str) -> Result<String, ValidationError> {
    let id = raw.trim();
    if id.is_empty() || is_frame_id(id) {
        return Ok(id.to_owned());
    }
    Err(ValidationError::on(
        "frame",
        locale::pick([
            "アイコンの枠の指定が正しくありません",
            "The avatar frame is not valid",
            "头像框的指定无效",
            "頭像框的指定無效",
            "아이콘 테두리 지정이 올바르지 않습니다",
        ]),
    ))
}

fn is_frame_id(id: &str) -> bool {
    let rest = id.strip_prefix(BUILTIN_PREFIX).or_else(|| id.strip_prefix(CUSTOM_PREFIX));
    rest.is_some_and(|rest| {
        (1..=64).contains(&rest.len()) && rest.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
    })
}

/// 生成を頼む説明を確かめる（前後の空白を除いて1〜200文字）
pub fn normalize_frame_description(raw: &str) -> Result<String, ValidationError> {
    let description = raw.trim();
    if description.is_empty() {
        return Err(ValidationError::on(
            "description",
            locale::pick([
                "どんな枠にするかを書いてください",
                "Describe the frame you want",
                "请描述想要的头像框",
                "請描述想要的頭像框",
                "원하는 테두리를 설명해 주십시오",
            ]),
        ));
    }
    ensure_max_chars(
        description,
        FRAME_DESCRIPTION_MAX_CHARS,
        "description",
        locale::pick([
            "説明は200文字以内にしてください",
            "Keep the description within 200 characters",
            "描述不能超过 200 个字符",
            "描述不能超過 200 個字元",
            "설명은 200자 이내로 입력하십시오",
        ]),
    )?;
    Ok(description.to_owned())
}

/// 枠の名前を決める。空なら説明の頭を使い、どちらも24文字で切る
pub fn frame_name(name: &str, description: &str) -> String {
    let name = name.trim();
    let source = if name.is_empty() { description.trim() } else { name };
    let first_line = source.lines().next().unwrap_or_default().trim();
    first_line.chars().take(FRAME_NAME_MAX_CHARS).collect()
}
