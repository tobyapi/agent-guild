//! 専門家の基本指示。エディターに表示する内蔵スキルと同じ本文を使う。

use std::sync::LazyLock;

use super::{parse_skill_file, Skill};

pub const NAME: &str = "expert-collaboration";
const SKILL_MD: &str = include_str!("../../../../../src/shared/assets/skills/expert-collaboration/SKILL.md");

pub fn body() -> &'static str {
    static BODY: LazyLock<String> = LazyLock::new(|| parse_skill_file(SKILL_MD, NAME).body);
    &BODY
}

/// 役割の指示として配る内蔵参照と、改名を含む同本文のコピー。同名でも独自の本文なら通常のスキルとして残す。
pub fn is_role_instruction(skill: &Skill) -> bool {
    skill.builtin_name() == Some(NAME) || skill.body.trim() == body().trim()
}
