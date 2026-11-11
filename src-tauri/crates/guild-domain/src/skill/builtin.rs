//! 内蔵スキル: アプリに同梱する Agent Skills（`src/shared/assets/skills/<name>/`。ブラウザのモックも同じファイルを読む）。
//! build.rs がフォルダの SKILL.md と付属ファイル（references/ など）を埋め込む。エージェントに付けると
//! `SkillSource::Builtin` で参照し、一覧と実行のたびにここから読み直す（アプリの更新に追従する）。

use serde::{Deserialize, Serialize};

use super::file::parse_skill_file;

/// 同梱する内蔵スキル1つ（フォルダ名・SKILL.md・付属ファイル）
pub struct BundledSkill {
    /// フォルダ名（frontmatter の name とそろえる）
    pub folder: &'static str,
    pub skill_md: &'static str,
    /// SKILL.md 以外のファイル（フォルダからの相対パス（/ 区切り）, 中身）
    pub files: &'static [(&'static str, &'static str)],
}

const BUNDLED: &[BundledSkill] = include!(concat!(env!("OUT_DIR"), "/builtin_skills.rs"));

/// TS の BuiltinSkill
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuiltinSkill {
    pub name: String,
    pub description: String,
    pub body: String,
    /// 付属ファイルのスキルのフォルダからの相対パス（/ 区切り、パスの順）
    pub files: Vec<String>,
}

/// 付属ファイル1つ（実行のときにスキルのフォルダへ書き出す）
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BuiltinSkillFile {
    /// スキルのフォルダからの相対パス（/ 区切り）
    pub path: String,
    pub content: String,
}

/// 内蔵スキルの一覧（name の順）。標準に合わないものは出さない（テストで全件が合うことを確かめる）
pub fn builtin_skills() -> Vec<BuiltinSkill> {
    let mut skills: Vec<BuiltinSkill> = BUNDLED
        .iter()
        .map(|bundled| (parse_skill_file(bundled.skill_md, bundled.folder), bundled))
        .filter(|(file, _)| file.problem.is_none())
        .map(|(file, bundled)| BuiltinSkill {
            name: file.name,
            description: file.description,
            body: file.body,
            files: bundled.files.iter().map(|(path, _)| (*path).to_owned()).collect(),
        })
        .collect();
    skills.sort_by(|a, b| a.name.cmp(&b.name));
    skills
}

/// name の内蔵スキル（この版のアプリになければ None）
pub fn find_builtin_skill(name: &str) -> Option<BuiltinSkill> {
    builtin_skills().into_iter().find(|skill| skill.name == name)
}

/// name の内蔵スキルの付属ファイル（この版のアプリになければ空）
pub fn builtin_skill_files(name: &str) -> Vec<BuiltinSkillFile> {
    let bundled = BUNDLED.iter().find(|bundled| parse_skill_file(bundled.skill_md, bundled.folder).name == name);
    bundled
        .map(|bundled| {
            bundled
                .files
                .iter()
                .map(|(path, content)| BuiltinSkillFile { path: (*path).to_owned(), content: (*content).to_owned() })
                .collect()
        })
        .unwrap_or_default()
}

/// 同梱する内蔵スキルの生の中身。テストで標準に合うことを確かめる
pub fn bundled_skills() -> &'static [BundledSkill] {
    BUNDLED
}
