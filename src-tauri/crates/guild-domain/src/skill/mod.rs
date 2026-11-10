//! スキル（Agent Skills 標準の SKILL.md）。DB が正で、実行のたびにランナーへ渡す（展開はランナーのアダプタ）。
//! スキルライブラリのフォルダを参照する linked のスキルは実行のたびに読み直した SKILL.md が、
//! 内蔵スキルを参照する builtin のスキルはアプリに同梱した SKILL.md が正。

mod builtin;
mod file;
mod frontmatter;
mod library;

use serde::{Deserialize, Serialize};

use super::error::{ensure_max_chars, ValidationError};
use super::ids::{AgentId, SkillId};

pub use builtin::{builtin_skill_files, builtin_skills, find_builtin_skill, BuiltinSkill};
pub use file::{parse_skill_file, SkillFile, SKILL_FILE};
pub use library::{
    validate_library_dirs, LibraryAddMode, LibrarySkill, SkillLibrary, LIBRARY_SCAN_DEPTH, LIBRARY_SKILL_LIMIT,
};

/// name の最大文字数（Agent Skills 標準）
pub const SKILL_NAME_MAX_CHARS: usize = 64;
/// description の最大文字数（Agent Skills 標準）
pub const SKILL_DESCRIPTION_MAX_CHARS: usize = 1024;

/// TS の SkillSource（スキルの出どころ。None ならアプリ内で書いたスキル）
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum SkillSource {
    /// スキルライブラリのフォルダを参照する。アプリ内では編集できない
    Linked {
        /// SKILL.md があるフォルダの絶対パス
        path: String,
    },
    /// アプリに同梱した内蔵スキルを参照する。アプリ内では編集できない
    Builtin {
        /// 内蔵スキルの name
        name: String,
    },
}

/// TS の Skill
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Skill {
    pub id: SkillId,
    pub agent_id: AgentId,
    /// 64文字以内の英小文字・数字・ハイフン。エージェント内で一意
    pub name: String,
    pub description: String,
    /// linked・builtin のときは、取得した時点で参照先から読んだ本文
    pub body: String,
    pub source: Option<SkillSource>,
    /// linked・builtin のスキルを読めなかったときの理由（DB には持たない）
    pub problem: Option<String>,
    pub updated_at: i64,
}

impl Skill {
    /// linked なら参照先のフォルダ
    pub fn linked_path(&self) -> Option<&str> {
        match &self.source {
            Some(SkillSource::Linked { path }) => Some(path),
            _ => None,
        }
    }

    /// builtin なら参照する内蔵スキルの name
    pub fn builtin_name(&self) -> Option<&str> {
        match &self.source {
            Some(SkillSource::Builtin { name }) => Some(name),
            _ => None,
        }
    }
}

/// TS の SkillInput（id が None なら新規）
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillInput {
    pub id: Option<SkillId>,
    pub agent_id: AgentId,
    pub name: String,
    pub description: String,
    pub body: String,
}

/// skills-changed イベントのペイロード
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillsChanged {
    pub agent_id: AgentId,
}

/// name を検証する（勝手に変換しない）: 64文字以内の英小文字・数字・ハイフンで、
/// 先頭と末尾はハイフン以外、ハイフンは連続させない（Agent Skills 標準）
pub fn validate_skill_name(name: &str) -> Result<(), ValidationError> {
    let invalid = |message: &str| Err(ValidationError::on("name", message));
    if name.is_empty() {
        return invalid("スキル名を入力してください");
    }
    ensure_max_chars(name, SKILL_NAME_MAX_CHARS, "name", "スキル名は64文字以内にしてください")?;
    let allowed = |c: char| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-';
    if !name.chars().all(allowed) {
        return invalid("スキル名に使えるのは英小文字・数字・ハイフンだけです（例: code-review）");
    }
    if name.starts_with('-') || name.ends_with('-') {
        return invalid("スキル名の先頭と末尾にはハイフンを使えません");
    }
    if name.contains("--") {
        return invalid("スキル名にハイフンを続けて使うことはできません");
    }
    Ok(())
}

/// description を検証する（必須。いつ使うスキルかをバックエンドが判断する手がかりになる）
pub fn normalize_skill_description(description: &str) -> Result<String, ValidationError> {
    let description = description.trim();
    if description.is_empty() {
        return Err(ValidationError::on("description", "スキルの説明を入力してください（いつ使うスキルかを書きます）"));
    }
    ensure_max_chars(
        description,
        SKILL_DESCRIPTION_MAX_CHARS,
        "description",
        "スキルの説明は1024文字以内にしてください",
    )?;
    Ok(description.to_owned())
}
