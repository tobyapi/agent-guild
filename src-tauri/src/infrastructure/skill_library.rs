//! スキルライブラリのフォルダの走査と SKILL.md の読み取り（SkillLibraryScanner の実装）。読むだけで書き換えない。
//! `.git`・`node_modules`・隠しフォルダ・シンボリックリンクはたどらない。付属ファイルの数え方はランナーのコピーと揃える。

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use guild_application::ports::{DirProblem, DirScan, FoundSkill, SkillFileError, SkillLibraryScanner};
use guild_domain::skill::{LIBRARY_SCAN_DEPTH, SKILL_FILE};

/// SKILL.md の大きさの上限（これを超えるものは読まない）
const SKILL_FILE_MAX_BYTES: u64 = 1024 * 1024;
/// 付属ファイルを数える上限（大きなフォルダで走査が止まらないように）
const FILE_COUNT_CAP: u32 = 10_000;
/// 付属ファイルとして数えない名前（ランナーもコピーしない）
const SKIPPED_NAMES: [&str; 2] = [".git", "node_modules"];

pub struct FsSkillLibrary;

impl SkillLibraryScanner for FsSkillLibrary {
    fn scan(&self, dir: &Path, limit: usize) -> Result<DirScan, DirProblem> {
        match fs::metadata(dir) {
            Ok(metadata) if metadata.is_dir() => {}
            Ok(_) => return Err(DirProblem::NotFolder),
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Err(DirProblem::Missing),
            Err(error) => return Err(DirProblem::Unreadable(error.to_string())),
        }
        let mut scan = DirScan::default();
        if is_skill_folder(dir) {
            add(dir, limit, &mut scan);
            return Ok(scan);
        }
        let children = subfolders(dir).map_err(|error| DirProblem::Unreadable(error.to_string()))?;
        for child in children {
            walk(&child, 1, limit, &mut scan);
        }
        Ok(scan)
    }

    fn read_skill_file(&self, folder: &Path) -> Result<String, SkillFileError> {
        if !folder.is_dir() {
            return Err(SkillFileError::FolderMissing);
        }
        let path = folder.join(SKILL_FILE);
        let unreadable = |error: io::Error| match error.kind() {
            io::ErrorKind::NotFound => SkillFileError::FileMissing,
            _ => SkillFileError::Unreadable(error.to_string()),
        };
        let metadata = fs::metadata(&path).map_err(unreadable)?;
        if metadata.len() > SKILL_FILE_MAX_BYTES {
            return Err(SkillFileError::Unreadable("1MB を超えています".to_owned()));
        }
        let bytes = fs::read(&path).map_err(unreadable)?;
        String::from_utf8(bytes).map_err(|_| SkillFileError::Unreadable("UTF-8 のテキストではありません".to_owned()))
    }

    fn is_folder(&self, path: &Path) -> bool {
        path.is_dir()
    }
}

/// SKILL.md があるフォルダはスキルとして加え、その下は探さない。なければ深さの上限まで下りる
fn walk(dir: &Path, depth: usize, limit: usize, scan: &mut DirScan) {
    if scan.truncated {
        return;
    }
    if is_skill_folder(dir) {
        add(dir, limit, scan);
        return;
    }
    if depth >= LIBRARY_SCAN_DEPTH {
        return;
    }
    match subfolders(dir) {
        Ok(children) => children.iter().for_each(|child| walk(child, depth + 1, limit, scan)),
        Err(error) => log::debug!("{} を読めないので飛ばします: {error}", dir.display()),
    }
}

fn add(dir: &Path, limit: usize, scan: &mut DirScan) {
    if scan.skills.len() >= limit {
        scan.truncated = true;
        return;
    }
    scan.skills.push(FoundSkill {
        folder: dir.to_path_buf(),
        file_count: count_files(dir, true),
        text: FsSkillLibrary.read_skill_file(dir),
    });
}

fn is_skill_folder(dir: &Path) -> bool {
    dir.join(SKILL_FILE).is_file()
}

/// たどってよい子フォルダ（名前順。隠しフォルダ・node_modules・シンボリックリンクを除く）
fn subfolders(dir: &Path) -> io::Result<Vec<PathBuf>> {
    let mut children = Vec::new();
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let Ok(file_type) = entry.file_type() else { continue };
        let name = entry.file_name().to_string_lossy().into_owned();
        if file_type.is_dir() && !file_type.is_symlink() && !name.starts_with('.') && name != "node_modules" {
            children.push(entry.path());
        }
    }
    children.sort();
    Ok(children)
}

/// SKILL.md（スキルのフォルダの直下のもの）以外のファイルの数。読めないフォルダは数えない
fn count_files(dir: &Path, is_root: bool) -> u32 {
    let Ok(entries) = fs::read_dir(dir) else { return 0 };
    let mut count = 0u32;
    for entry in entries.flatten() {
        let Ok(file_type) = entry.file_type() else { continue };
        let name = entry.file_name().to_string_lossy().into_owned();
        if file_type.is_symlink() || SKIPPED_NAMES.contains(&name.as_str()) || (is_root && name == SKILL_FILE) {
            continue;
        }
        count = count.saturating_add(if file_type.is_dir() { count_files(&entry.path(), false) } else { 1 });
        if count >= FILE_COUNT_CAP {
            return FILE_COUNT_CAP;
        }
    }
    count
}
