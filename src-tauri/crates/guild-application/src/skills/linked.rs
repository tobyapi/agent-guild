//! linked のスキル: 実行と一覧のたびにライブラリのフォルダの SKILL.md を読み直す（DB の name・description・本文は写し）。

use std::path::Path;

use guild_domain::skill::{parse_skill_file, Skill, SkillFile};

use crate::ports::SkillLibraryScanner;

/// linked なら SKILL.md を読み直した内容にする。読めない・標準に合わなければ DB の写しのまま problem に理由を入れる
pub(crate) fn refresh(library: &dyn SkillLibraryScanner, skill: Skill) -> Skill {
    let Some(path) = skill.linked_path() else {
        return skill;
    };
    match read(library, Path::new(path)) {
        Ok(file) => Skill { name: file.name, description: file.description, body: file.body, problem: None, ..skill },
        Err(problem) => Skill { problem: Some(problem), ..skill },
    }
}

/// 実行に渡すスキル: linked は読み直し、読めないものと name が先のものと重なるものは外して警告ログを残す
pub(crate) fn runnable(library: &dyn SkillLibraryScanner, agent_name: &str, skills: Vec<Skill>) -> Vec<Skill> {
    let mut picked: Vec<Skill> = Vec::with_capacity(skills.len());
    for skill in skills.into_iter().map(|skill| refresh(library, skill)) {
        if let Some(problem) = &skill.problem {
            log::warn!("{agent_name} のスキル「{}」を読めないため、外して実行します: {problem}", skill.name);
        } else if picked.iter().any(|other| other.name == skill.name) {
            log::warn!("{agent_name} のスキル「{}」は同じ名前のスキルがあるため、外して実行します", skill.name);
        } else {
            picked.push(skill);
        }
    }
    picked
}

/// フォルダの SKILL.md を読む。読めない・標準に合わなければ理由（使用者向けの日本語）
pub(crate) fn read(library: &dyn SkillLibraryScanner, folder: &Path) -> Result<SkillFile, String> {
    let text = library.read_skill_file(folder).map_err(|error| error.to_string())?;
    let file = parse_skill_file(&text, &folder_name(folder));
    match file.problem {
        Some(problem) => Err(problem),
        None => Ok(file),
    }
}

/// フォルダ名（ドライブの直下などで名前がなければパス全体）
pub(crate) fn folder_name(folder: &Path) -> String {
    match folder.file_name() {
        Some(name) => name.to_string_lossy().into_owned(),
        None => folder.display().to_string(),
    }
}
