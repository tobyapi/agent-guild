//! 内蔵スキル: アプリに同梱する Agent Skills（`src/shared/assets/skills/<name>/SKILL.md`。ブラウザのモックも同じファイルを読む）。
//! エージェントに付けると `SkillSource::Builtin` で参照し、一覧と実行のたびにここから読み直す（アプリの更新に追従する）。

use serde::{Deserialize, Serialize};

use super::file::parse_skill_file;

/// 同梱する SKILL.md（フォルダ名, 中身）。足すときはフォルダ名と frontmatter の name をそろえる
const FILES: &[(&str, &str)] = &[
    ("code-review", include_str!("../../../../../src/shared/assets/skills/code-review/SKILL.md")),
    ("bug-investigation", include_str!("../../../../../src/shared/assets/skills/bug-investigation/SKILL.md")),
    ("research-report", include_str!("../../../../../src/shared/assets/skills/research-report/SKILL.md")),
    ("task-breakdown", include_str!("../../../../../src/shared/assets/skills/task-breakdown/SKILL.md")),
    ("meeting-minutes", include_str!("../../../../../src/shared/assets/skills/meeting-minutes/SKILL.md")),
    ("proofreading", include_str!("../../../../../src/shared/assets/skills/proofreading/SKILL.md")),
];

/// TS の BuiltinSkill
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuiltinSkill {
    pub name: String,
    pub description: String,
    pub body: String,
}

/// 内蔵スキルの一覧（name の順）。標準に合わないものは出さない（テストで全件が合うことを確かめる）
pub fn builtin_skills() -> Vec<BuiltinSkill> {
    let mut skills: Vec<BuiltinSkill> = FILES
        .iter()
        .map(|(folder, text)| parse_skill_file(text, folder))
        .filter(|file| file.problem.is_none())
        .map(|file| BuiltinSkill { name: file.name, description: file.description, body: file.body })
        .collect();
    skills.sort_by(|a, b| a.name.cmp(&b.name));
    skills
}

/// name の内蔵スキル（この版のアプリになければ None）
pub fn find_builtin_skill(name: &str) -> Option<BuiltinSkill> {
    builtin_skills().into_iter().find(|skill| skill.name == name)
}

/// 同梱する SKILL.md の生の中身（フォルダ名, 中身）。テストで標準に合うことを確かめる
pub fn builtin_skill_files() -> &'static [(&'static str, &'static str)] {
    FILES
}
