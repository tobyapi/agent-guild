//! スキルライブラリのフォルダのフェイク: ライブラリのフォルダごとのスキルのフォルダと、各 SKILL.md の中身。

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use guild_application::ports::{DirProblem, DirScan, FoundSkill, SkillFileError, SkillLibraryScanner};
use parking_lot::Mutex;

/// テスト用の絶対パス（"skills/unity" → Windows は "D:\skills\unity"、それ以外は "/skills/unity"）
pub fn abs(path: &str) -> String {
    if cfg!(windows) {
        format!("D:\\{}", path.replace('/', "\\"))
    } else {
        format!("/{path}")
    }
}

#[derive(Default)]
pub struct FakeLibrary {
    /// ライブラリのフォルダ → (スキルのフォルダ, 付属ファイルの数)。ないフォルダは Missing
    dirs: Mutex<HashMap<PathBuf, Vec<(PathBuf, u32)>>>,
    /// スキルのフォルダ → SKILL.md の中身。ないフォルダは FolderMissing
    files: Mutex<HashMap<PathBuf, String>>,
}

impl FakeLibrary {
    /// ライブラリのフォルダ library_dir に、スキルのフォルダ folder を置く
    pub fn put(&self, library_dir: &str, folder: &str, text: &str, file_count: u32) {
        let entry = (PathBuf::from(folder), file_count);
        self.dirs.lock().entry(PathBuf::from(library_dir)).or_default().push(entry);
        self.write(folder, text);
    }

    /// SKILL.md を書き換える
    pub fn write(&self, folder: &str, text: &str) {
        self.files.lock().insert(PathBuf::from(folder), text.to_owned());
    }

    /// スキルのフォルダを消す
    pub fn remove(&self, folder: &str) {
        self.files.lock().remove(Path::new(folder));
    }
}

impl SkillLibraryScanner for FakeLibrary {
    fn scan(&self, dir: &Path, limit: usize) -> Result<DirScan, DirProblem> {
        let dirs = self.dirs.lock();
        let folders = dirs.get(dir).ok_or(DirProblem::Missing)?;
        let files = self.files.lock();
        let found = |(folder, file_count): &(PathBuf, u32)| FoundSkill {
            folder: folder.clone(),
            file_count: *file_count,
            text: files.get(folder).cloned().ok_or(SkillFileError::FileMissing),
        };
        Ok(DirScan { skills: folders.iter().take(limit).map(found).collect(), truncated: folders.len() > limit })
    }

    fn read_skill_file(&self, folder: &Path) -> Result<String, SkillFileError> {
        self.files.lock().get(folder).cloned().ok_or(SkillFileError::FolderMissing)
    }

    fn is_folder(&self, path: &Path) -> bool {
        self.files.lock().contains_key(path) || self.dirs.lock().contains_key(path)
    }
}
