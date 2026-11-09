//! スキルライブラリの走査: 深さ3まで・SKILL.md のフォルダの下は探さない・隠しフォルダと node_modules を飛ばす・上限で打ち切る。

use std::fs;
use std::path::{Path, PathBuf};

use guild_application::ports::{DirProblem, SkillFileError, SkillLibraryScanner};

use super::TempDir;
use crate::infrastructure::skill_library::FsSkillLibrary;

fn skill(dir: &Path, relative: &str) -> PathBuf {
    let folder = dir.join(relative);
    fs::create_dir_all(&folder).unwrap();
    fs::write(folder.join("SKILL.md"), format!("---\nname: {relative}\n---\n")).unwrap();
    folder
}

fn found(dir: &Path, limit: usize) -> (Vec<PathBuf>, bool) {
    let scan = FsSkillLibrary.scan(dir, limit).unwrap();
    let mut folders: Vec<PathBuf> = scan.skills.into_iter().map(|s| s.folder).collect();
    folders.sort();
    (folders, scan.truncated)
}

#[test]
fn finds_skill_folders_down_to_depth_three_and_skips_hidden_ones() {
    let library = TempDir::new("library");
    let root = &library.0;
    let shallow = skill(root, "a");
    let deep = skill(root, "x/y/z");
    skill(root, "x/y/z/w/too-deep");
    skill(root, "a/inner");
    skill(root, ".hidden/b");
    skill(root, "node_modules/c");
    skill(root, "p/q/r/s");
    let (folders, truncated) = found(root, 500);
    assert_eq!(folders, vec![shallow, deep], "深さ4と SKILL.md の下と隠しフォルダは探さない");
    assert!(!truncated);
}

#[test]
fn the_library_folder_itself_can_be_a_skill() {
    let library = TempDir::new("self");
    fs::write(library.0.join("SKILL.md"), "---\nname: self\n---\n").unwrap();
    skill(&library.0, "child");
    assert_eq!(found(&library.0, 500).0, vec![library.0.clone()]);
}

#[test]
fn stops_at_the_limit_and_counts_attachments() {
    let library = TempDir::new("limit");
    let folder = skill(&library.0, "s1");
    fs::create_dir_all(folder.join("scripts")).unwrap();
    fs::create_dir_all(folder.join(".git")).unwrap();
    fs::write(folder.join("scripts").join("run.ps1"), "echo").unwrap();
    fs::write(folder.join("README.md"), "# r").unwrap();
    fs::write(folder.join(".git").join("HEAD"), "ref").unwrap();
    skill(&library.0, "s2");
    skill(&library.0, "s3");
    let scan = FsSkillLibrary.scan(&library.0, 2).unwrap();
    assert_eq!((scan.skills.len(), scan.truncated), (2, true));
    assert_eq!(scan.skills[0].file_count, 2, "SKILL.md と .git は数えない");
    assert_eq!(scan.skills[0].text.as_deref(), Ok("---\nname: s1\n---\n"));
    assert!(!FsSkillLibrary.scan(&library.0, 3).unwrap().truncated, "ちょうど上限なら打ち切りではない");
}

#[test]
fn reports_missing_folders_files_and_non_folders() {
    let library = TempDir::new("problems");
    let file = library.0.join("note.txt");
    fs::write(&file, "x").unwrap();
    assert_eq!(FsSkillLibrary.scan(&library.0.join("nowhere"), 500), Err(DirProblem::Missing));
    assert_eq!(FsSkillLibrary.scan(&file, 500), Err(DirProblem::NotFolder));
    assert_eq!(FsSkillLibrary.read_skill_file(&library.0.join("nowhere")), Err(SkillFileError::FolderMissing));
    assert_eq!(FsSkillLibrary.read_skill_file(&library.0), Err(SkillFileError::FileMissing));
    fs::write(library.0.join("SKILL.md"), [0xff, 0xfe, 0x00]).unwrap();
    assert!(matches!(FsSkillLibrary.read_skill_file(&library.0), Err(SkillFileError::Unreadable(_))));
    assert!(FsSkillLibrary.is_folder(&library.0));
    assert!(!FsSkillLibrary.is_folder(&file));
}
