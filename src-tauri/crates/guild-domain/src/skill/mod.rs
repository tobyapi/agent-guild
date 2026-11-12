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
use crate::locale;

pub use builtin::{
    builtin_skill_files, builtin_skills, bundled_skills, find_builtin_skill, BuiltinSkill, BuiltinSkillFile,
    BundledSkill,
};
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
        return invalid(locale::pick([
            "スキル名を入力してください",
            "Enter a skill name",
            "请输入技能名称",
            "請輸入技能名稱",
            "스킬 이름을 입력하십시오",
        ]));
    }
    ensure_max_chars(
        name,
        SKILL_NAME_MAX_CHARS,
        "name",
        locale::pick([
            "スキル名は64文字以内にしてください",
            "Skill names can be up to 64 characters",
            "技能名称不能超过 64 个字符",
            "技能名稱不能超過 64 個字元",
            "스킬 이름은 64자 이내로 입력하십시오",
        ]),
    )?;
    let allowed = |c: char| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-';
    if !name.chars().all(allowed) {
        return invalid(locale::pick([
            "スキル名に使えるのは英小文字・数字・ハイフンだけです（例: code-review）",
            "Skill names can only use lowercase letters, digits, and hyphens (e.g. code-review)",
            "技能名称只能使用小写英文字母、数字和连字符（例如：code-review）",
            "技能名稱只能使用小寫英文字母、數字和連字號（例如：code-review）",
            "스킬 이름에는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다(예: code-review)",
        ]));
    }
    if name.starts_with('-') || name.ends_with('-') {
        return invalid(locale::pick([
            "スキル名の先頭と末尾にはハイフンを使えません",
            "Skill names cannot start or end with a hyphen",
            "技能名称的开头和结尾不能使用连字符",
            "技能名稱的開頭和結尾不能使用連字號",
            "스킬 이름의 처음과 끝에는 하이픈을 사용할 수 없습니다",
        ]));
    }
    if name.contains("--") {
        return invalid(locale::pick([
            "スキル名にハイフンを続けて使うことはできません",
            "Skill names cannot contain consecutive hyphens",
            "技能名称中不能连续使用连字符",
            "技能名稱中不能連續使用連字號",
            "스킬 이름에 하이픈을 연속으로 사용할 수 없습니다",
        ]));
    }
    Ok(())
}

/// 同じエージェントに同じ名前のスキルがあるときの文面（いまの言語）
pub fn skill_name_taken(name: &str) -> String {
    locale::pick([
        format!("「{name}」という名前のスキルはすでにあります"),
        format!("A skill named “{name}” already exists"),
        format!("已存在名为“{name}”的技能"),
        format!("已存在名為「{name}」的技能"),
        format!("\"{name}\"라는 이름의 스킬이 이미 있습니다"),
    ])
}

/// description を検証する（必須。いつ使うスキルかをバックエンドが判断する手がかりになる）
pub fn normalize_skill_description(description: &str) -> Result<String, ValidationError> {
    let description = description.trim();
    if description.is_empty() {
        return Err(ValidationError::on(
            "description",
            locale::pick([
                "スキルの説明を入力してください（いつ使うスキルかを書きます）",
                "Enter a skill description (describe when to use the skill)",
                "请输入技能说明（写明何时使用该技能）",
                "請輸入技能說明（寫明何時使用該技能）",
                "스킬 설명을 입력하십시오(언제 사용하는 스킬인지 작성합니다)",
            ]),
        ));
    }
    ensure_max_chars(
        description,
        SKILL_DESCRIPTION_MAX_CHARS,
        "description",
        locale::pick([
            "スキルの説明は1024文字以内にしてください",
            "Skill descriptions can be up to 1,024 characters",
            "技能说明不能超过 1024 个字符",
            "技能說明不能超過 1024 個字元",
            "스킬 설명은 1,024자 이내로 입력하십시오",
        ]),
    )?;
    Ok(description.to_owned())
}
