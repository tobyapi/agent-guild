//! スキルライブラリのユースケース（design.md §14）: 走査・フォルダの指定・エージェントへの追加（link / copy）・フォルダを開く。

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use guild_domain::error::ValidationError;
use guild_domain::ids::{AgentId, SkillId};
use guild_domain::skill::{
    parse_skill_file, validate_library_dirs, LibraryAddMode, LibrarySkill, Skill, SkillLibrary, SkillSource,
    LIBRARY_SKILL_LIMIT,
};

use super::linked::folder_name;
use super::{ensure_name_free, require_agent};
use crate::error::{AppError, AppResult};
use crate::ports::{Folders, FoundSkill, SettingsStore, SkillFileError, SkillLibraryScanner};
use crate::services::Ports;

#[derive(Clone)]
pub struct SkillLibraryService {
    ports: Ports,
    settings: Arc<dyn SettingsStore>,
    folders: Arc<dyn Folders>,
}

impl SkillLibraryService {
    pub fn new(ports: Ports, settings: Arc<dyn SettingsStore>, folders: Arc<dyn Folders>) -> Self {
        Self { ports, settings, folders }
    }

    /// 指定のフォルダを走査し直す
    pub fn get(&self) -> AppResult<SkillLibrary> {
        let dirs = self.settings.load()?.skill_library_dirs;
        Ok(scan(self.ports.library.as_ref(), &dirs))
    }

    /// フォルダの指定を検証して settings.json に保存し、skill-library-changed を出す
    pub fn set_dirs(&self, dirs: &[String]) -> AppResult<SkillLibrary> {
        let dirs: Vec<PathBuf> = validate_library_dirs(dirs)?.into_iter().map(PathBuf::from).collect();
        let mut settings = self.settings.load()?;
        settings.skill_library_dirs = dirs;
        self.settings.save(&settings)?;
        self.ports.events.skill_library_changed();
        Ok(scan(self.ports.library.as_ref(), &settings.skill_library_dirs))
    }

    /// path（SKILL.md があるフォルダ）のスキルをエージェントに付ける。同じ name があれば Conflict
    pub fn add(&self, agent_id: &AgentId, path: &str, mode: LibraryAddMode) -> AppResult<Skill> {
        require_agent(&self.ports, agent_id)?;
        let path = path.trim();
        let folder = Path::new(path);
        if !folder.is_absolute() {
            return Err(ValidationError::on("path", "スキルのフォルダは絶対パスで指定してください").into());
        }
        let text = self.ports.library.read_skill_file(folder).map_err(|error| match error {
            SkillFileError::FolderMissing | SkillFileError::FileMissing => {
                AppError::NotFound("SKILL.md のあるフォルダ")
            }
            SkillFileError::Unreadable(_) => AppError::validation(error.to_string()),
        })?;
        let file = parse_skill_file(&text, &folder_name(folder));
        if let Some(problem) = file.problem {
            return Err(AppError::validation(format!(
                "このスキルは Agent Skills の形式に合わないため追加できません: {problem}"
            )));
        }
        ensure_name_free(&self.ports, agent_id, &file.name, None)?;
        let source = match mode {
            LibraryAddMode::Link => Some(SkillSource::Linked { path: path.to_owned() }),
            LibraryAddMode::Copy => None,
        };
        let skill = Skill {
            id: SkillId::new(self.ports.ids.new_id()),
            agent_id: agent_id.clone(),
            name: file.name,
            description: file.description,
            body: file.body,
            source,
            problem: None,
            updated_at: self.ports.clock.now_ms(),
        };
        self.ports.skills.upsert(&skill)?;
        self.ports.events.skills_changed(agent_id);
        Ok(skill)
    }

    /// OS のファイラでフォルダを開く（フォルダでなければ NotFound。ファイルは開かない）
    pub fn reveal(&self, path: &str) -> AppResult<()> {
        let folder = Path::new(path.trim());
        if !folder.is_absolute() || !self.ports.library.is_folder(folder) {
            return Err(AppError::NotFound("フォルダ"));
        }
        self.folders.reveal(folder)
    }
}

/// dirs の順に走査する。同じフォルダの中は name の順。全体で LIBRARY_SKILL_LIMIT 件まで
fn scan(library: &dyn SkillLibraryScanner, dirs: &[PathBuf]) -> SkillLibrary {
    let too_many = format!("スキルが多すぎるため、{LIBRARY_SKILL_LIMIT}件で打ち切りました");
    let mut skills: Vec<LibrarySkill> = Vec::new();
    let mut dir_problems = BTreeMap::new();
    for dir in dirs {
        let key = dir.display().to_string();
        let remaining = LIBRARY_SKILL_LIMIT.saturating_sub(skills.len());
        if remaining == 0 {
            dir_problems.insert(key, too_many.clone());
            continue;
        }
        match library.scan(dir, remaining) {
            Ok(found) => {
                if found.truncated {
                    dir_problems.insert(key.clone(), too_many.clone());
                }
                let mut in_dir: Vec<LibrarySkill> = found.skills.into_iter().map(|f| library_skill(&key, f)).collect();
                in_dir.sort_by(|a, b| a.name.cmp(&b.name).then_with(|| a.path.cmp(&b.path)));
                skills.extend(in_dir);
            }
            Err(problem) => {
                dir_problems.insert(key, problem.to_string());
            }
        }
    }
    SkillLibrary { dirs: dirs.iter().map(|dir| dir.display().to_string()).collect(), skills, dir_problems }
}

fn library_skill(library_dir: &str, found: FoundSkill) -> LibrarySkill {
    let fallback = folder_name(&found.folder);
    let (name, description, problem) = match &found.text {
        Ok(text) => {
            let file = parse_skill_file(text, &fallback);
            (file.name, file.description, file.problem)
        }
        Err(error) => (fallback, String::new(), Some(error.to_string())),
    };
    LibrarySkill {
        path: found.folder.display().to_string(),
        library_dir: library_dir.to_owned(),
        name,
        description,
        file_count: found.file_count,
        problem,
    }
}
