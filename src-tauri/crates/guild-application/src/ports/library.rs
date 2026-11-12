//! スキルライブラリのフォルダを読むポート（書き換えない）。SKILL.md の解釈は guild-domain の純粋関数で行う。

use std::path::{Path, PathBuf};

use guild_domain::locale;

/// 走査で見つけたスキル（SKILL.md があるフォルダ1つ）
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FoundSkill {
    pub folder: PathBuf,
    /// SKILL.md 以外の付属ファイルの数
    pub file_count: u32,
    /// SKILL.md の中身
    pub text: Result<String, SkillFileError>,
}

/// ライブラリのフォルダ1つを走査した結果
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct DirScan {
    pub skills: Vec<FoundSkill>,
    /// 上限に達して打ち切った
    pub truncated: bool,
}

/// ライブラリのフォルダの問題（使用者向けの文面。いまの言語）
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum DirProblem {
    #[error("{}", folder_missing())]
    Missing,
    #[error("{}", not_folder())]
    NotFolder,
    #[error("{}", folder_unreadable(.0))]
    Unreadable(String),
}

/// スキルのフォルダの SKILL.md を読めない理由（使用者向けの文面。いまの言語）
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum SkillFileError {
    #[error("{}", folder_missing())]
    FolderMissing,
    #[error("{}", file_missing())]
    FileMissing,
    #[error("{}", file_unreadable(.0))]
    Unreadable(String),
}

fn folder_missing() -> &'static str {
    locale::pick([
        "フォルダが見つかりません",
        "Folder not found",
        "找不到文件夹",
        "找不到資料夾",
        "폴더를 찾을 수 없습니다",
    ])
}

fn not_folder() -> &'static str {
    locale::pick(["フォルダではありません", "Not a folder", "不是文件夹", "不是資料夾", "폴더가 아닙니다"])
}

fn folder_unreadable(detail: &str) -> String {
    locale::pick([
        format!("フォルダを読めません（{detail}）"),
        format!("Cannot read the folder ({detail})"),
        format!("无法读取文件夹（{detail}）"),
        format!("無法讀取資料夾（{detail}）"),
        format!("폴더를 읽을 수 없습니다({detail})"),
    ])
}

fn file_missing() -> &'static str {
    locale::pick([
        "SKILL.md が見つかりません",
        "SKILL.md not found",
        "找不到 SKILL.md",
        "找不到 SKILL.md",
        "SKILL.md를 찾을 수 없습니다",
    ])
}

fn file_unreadable(detail: &str) -> String {
    locale::pick([
        format!("SKILL.md を読めません（{detail}）"),
        format!("Cannot read SKILL.md ({detail})"),
        format!("无法读取 SKILL.md（{detail}）"),
        format!("無法讀取 SKILL.md（{detail}）"),
        format!("SKILL.md를 읽을 수 없습니다({detail})"),
    ])
}

pub trait SkillLibraryScanner: Send + Sync {
    /// ライブラリのフォルダを走査する（深さは guild_domain::skill::LIBRARY_SCAN_DEPTH まで。
    /// `.git`・`node_modules`・隠しフォルダ・シンボリックリンクはたどらない）。limit 件見つけたら打ち切る
    fn scan(&self, dir: &Path, limit: usize) -> Result<DirScan, DirProblem>;
    /// スキルのフォルダの SKILL.md を読む
    fn read_skill_file(&self, folder: &Path) -> Result<String, SkillFileError>;
    /// フォルダとして存在するか（シンボリックリンクの先がフォルダでもよい）
    fn is_folder(&self, path: &Path) -> bool;
}
