//! マシンごとの設定ファイル <app_config_dir>/settings.json（{ "version": 1, "dataDir": string | null, "skillLibraryDirs": string[] }）。
//! データフォルダの外に置くので、どの保存先でも見つけられる。未知のフィールドは保持して書き戻し、
//! version が新しすぎるファイルは読むだけで書き換えない。

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use guild_application::ports::{LaunchSettings, SettingsStore};
use guild_application::{AppError, AppResult};
use serde_json::{Map, Value};

pub const SETTINGS_FILE: &str = "settings.json";
const VERSION: u64 = 1;

pub struct SettingsFile {
    path: PathBuf,
}

impl SettingsFile {
    pub fn in_dir(config_dir: &Path) -> Self {
        Self { path: config_dir.join(SETTINGS_FILE) }
    }

    /// 設定された保存先（なければ None）
    pub fn data_dir(&self) -> Result<Option<PathBuf>, String> {
        Ok(data_dir_of(&self.read()?))
    }

    /// ファイルがなければ空のオブジェクト
    fn read(&self) -> Result<Map<String, Value>, String> {
        let text = match fs::read_to_string(&self.path) {
            Ok(text) => text,
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(Map::new()),
            Err(error) => return Err(format!("{} を読めません: {error}", self.path.display())),
        };
        match serde_json::from_str::<Value>(&text) {
            Ok(Value::Object(object)) => Ok(object),
            Ok(_) => Err(format!("{} の形が正しくありません", self.path.display())),
            Err(error) => Err(format!("{} を読めません: {error}", self.path.display())),
        }
    }

    /// 一時ファイルに書いてから置き換える（途中で落ちても壊れない）
    fn write(&self, object: &Map<String, Value>) -> Result<(), String> {
        let text = serde_json::to_string_pretty(object).map_err(|e| e.to_string())?;
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let temp = self.path.with_extension("json.tmp");
        fs::write(&temp, text).and_then(|()| fs::rename(&temp, &self.path)).map_err(|e| e.to_string())
    }
}

impl SettingsStore for SettingsFile {
    fn load(&self) -> AppResult<LaunchSettings> {
        let object = self.read().map_err(AppError::Storage)?;
        Ok(LaunchSettings { data_dir: data_dir_of(&object), skill_library_dirs: library_dirs_of(&object) })
    }

    fn save(&self, settings: &LaunchSettings) -> AppResult<()> {
        let mut object = self.read().map_err(AppError::Storage)?;
        let version = object.get("version").and_then(Value::as_u64).unwrap_or(VERSION);
        if version > VERSION {
            return Err(AppError::Storage(
                "新しい版のアプリの設定ファイルなので、書き換えません".to_owned(),
            ));
        }
        object.insert("version".to_owned(), Value::from(VERSION));
        let data_dir = settings.data_dir.as_ref().map(|dir| Value::String(dir.display().to_string()));
        object.insert("dataDir".to_owned(), data_dir.unwrap_or(Value::Null));
        let library_dirs = settings.skill_library_dirs.iter().map(|dir| Value::String(dir.display().to_string()));
        object.insert("skillLibraryDirs".to_owned(), Value::Array(library_dirs.collect()));
        self.write(&object).map_err(|e| AppError::Storage(format!("設定を保存できませんでした: {e}")))
    }
}

fn data_dir_of(object: &Map<String, Value>) -> Option<PathBuf> {
    object.get("dataDir").and_then(Value::as_str).map(PathBuf::from)
}

/// 文字列でない要素は無視する
fn library_dirs_of(object: &Map<String, Value>) -> Vec<PathBuf> {
    let items = object.get("skillLibraryDirs").and_then(Value::as_array);
    items.map(|items| items.iter().filter_map(Value::as_str).map(PathBuf::from).collect()).unwrap_or_default()
}
