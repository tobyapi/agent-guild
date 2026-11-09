//! スキル（専門知識の手引き）の一覧。本文はランナーのアダプタが SDK の置き場所に展開する。

use crate::agent::Permissions;
use crate::skill::Skill;

pub(super) fn section(skills: &[Skill], permissions: &Permissions) -> String {
    if !permissions.skills || skills.is_empty() {
        return String::new();
    }
    let list = skills
        .iter()
        .map(|skill| format!("- {}: {}", skill.name, skill.description))
        .collect::<Vec<_>>()
        .join("\n");
    format!(
        "## あなたのスキル（専門知識の手引き）
{list}
関係するスキルがあれば、必ず中身を読んでから取りかかってください。
"
    )
}
