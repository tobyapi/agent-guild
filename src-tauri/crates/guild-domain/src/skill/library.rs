//! スキルライブラリ: 既存の Agent Skills のフォルダ（`<name>/SKILL.md` と付属ファイル）を集めた場所。
//! フォルダの指定は settings.json の skillLibraryDirs（マシンごと）。アプリはライブラリを読むだけで書き換えない。

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::ValidationError;
use crate::locale;

/// 走査で見つけるスキルの数の上限（全フォルダの合計）
pub const LIBRARY_SKILL_LIMIT: usize = 500;
/// 走査する深さ（ライブラリのフォルダ自身が 0）
pub const LIBRARY_SCAN_DEPTH: usize = 3;

/// TS の LibrarySkill（SKILL.md があるフォルダ1つ）
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibrarySkill {
    /// SKILL.md があるフォルダの絶対パス（追加するときの識別子）
    pub path: String,
    /// 見つかったライブラリのフォルダ（設定で指定したもの）
    pub library_dir: String,
    /// frontmatter の name（読めなければフォルダ名）
    pub name: String,
    pub description: String,
    /// SKILL.md 以外の付属ファイルの数
    pub file_count: u32,
    /// そのままでは追加できない理由。問題なければ None
    pub problem: Option<String>,
}

/// TS の SkillLibrary
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillLibrary {
    /// 設定で指定したライブラリのフォルダ（使用者が並べた順）
    pub dirs: Vec<String>,
    /// dirs の順、同じフォルダの中では name の順
    pub skills: Vec<LibrarySkill>,
    /// フォルダごとの問題（見つからない・読めない）。キーは dirs の要素
    pub dir_problems: BTreeMap<String, String>,
}

/// TS の LibraryAddMode: link = 参照して実行のたびに読み直す / copy = 取り込んでアプリ内で編集する
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LibraryAddMode {
    Link,
    Copy,
}

/// ライブラリのフォルダの指定を検証する: 絶対パスで、重複も入れ子もないこと（前後の空白は除く）
pub fn validate_library_dirs(dirs: &[String]) -> Result<Vec<String>, ValidationError> {
    let invalid = |message: String| Err(ValidationError::on("dirs", message));
    let dirs: Vec<String> = dirs.iter().map(|dir| dir.trim().to_owned()).collect();
    for (index, dir) in dirs.iter().enumerate() {
        if !Path::new(dir).is_absolute() {
            return invalid(locale::pick([
                format!("「{dir}」は絶対パスではありません（例: D:\\skills）"),
                format!("“{dir}” is not an absolute path (e.g. D:\\skills)"),
                format!("“{dir}”不是绝对路径（例如：D:\\skills）"),
                format!("「{dir}」不是絕對路徑（例如：D:\\skills）"),
                format!("\"{dir}\"은(는) 절대 경로가 아닙니다(예: D:\\skills)"),
            ]));
        }
        for other in &dirs[..index] {
            let (key, other_key) = (folder_key(dir), folder_key(other));
            if key == other_key {
                return invalid(locale::pick([
                    format!("「{dir}」が重複しています"),
                    format!("“{dir}” is listed more than once"),
                    format!("“{dir}”重复"),
                    format!("「{dir}」重複"),
                    format!("\"{dir}\"이(가) 중복되었습니다"),
                ]));
            }
            if key.starts_with(&other_key) || other_key.starts_with(&key) {
                return invalid(locale::pick([
                    format!("「{dir}」と「{other}」は入れ子になっています（どちらか一方だけを指定してください）"),
                    format!("“{dir}” and “{other}” are nested (specify only one of them)"),
                    format!("“{dir}”和“{other}”相互嵌套（请只指定其中一个）"),
                    format!("「{dir}」和「{other}」相互巢狀（請只指定其中一個）"),
                    format!("\"{dir}\"과(와) \"{other}\"이(가) 중첩되어 있습니다(둘 중 하나만 지정하십시오)"),
                ]));
            }
        }
    }
    Ok(dirs)
}

/// 比べるためのフォルダの形（区切りの違いと末尾の区切りをならし、Windows では大文字小文字を区別しない）
fn folder_key(dir: &str) -> PathBuf {
    let normalized: PathBuf = Path::new(dir).components().collect();
    if cfg!(windows) {
        PathBuf::from(normalized.to_string_lossy().to_lowercase())
    } else {
        normalized
    }
}
