//! マシンごとの設定ファイル <app_config_dir>/settings.json
//! （{ "version": 1, "dataDir": string | null, "skillLibraryDirs": string[], "setupDone": boolean, "language"?: string }）。
//! language は言語を選んでから書く（ない・知らない値なら None。日本語として扱う）。足しただけなので version は 1 のまま。
//! データフォルダの外に置くので、どの保存先でも見つけられる。未知のフィールドは保持して書き戻し、
//! version が新しすぎるファイルは読むだけで書き換えない。

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use guild_application::ports::{LaunchSettings, SettingsStore};
use guild_application::{AppError, AppResult};
use guild_domain::locale::{self, Language};
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
            Err(error) => return Err(unreadable(&self.path, &error.to_string())),
        };
        match serde_json::from_str::<Value>(&text) {
            Ok(Value::Object(object)) => Ok(object),
            Ok(_) => Err(malformed(&self.path)),
            Err(error) => Err(unreadable(&self.path, &error.to_string())),
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
        Ok(LaunchSettings {
            data_dir: data_dir_of(&object),
            skill_library_dirs: library_dirs_of(&object),
            setup_done: object.get("setupDone").and_then(Value::as_bool).unwrap_or(false),
            language: object.get("language").and_then(Value::as_str).and_then(Language::parse),
            backend_auth_modes: auth_modes_of(&object),
        })
    }

    fn save(&self, settings: &LaunchSettings) -> AppResult<()> {
        let mut object = self.read().map_err(AppError::Storage)?;
        let version = object.get("version").and_then(Value::as_u64).unwrap_or(VERSION);
        if version > VERSION {
            return Err(AppError::Storage(
                locale::pick([
                    "新しい版のアプリの設定ファイルなので、書き換えません",
                    "The settings file was made by a newer version of the app, so it was left unchanged",
                    "设置文件由较新版本的应用创建，因此未改写",
                    "設定檔由較新版本的應用程式建立，因此未改寫",
                    "더 새로운 버전의 앱이 만든 설정 파일이라 덮어쓰지 않았습니다",
                ])
                .to_owned(),
            ));
        }
        object.insert("version".to_owned(), Value::from(VERSION));
        let data_dir = settings.data_dir.as_ref().map(|dir| Value::String(dir.display().to_string()));
        object.insert("dataDir".to_owned(), data_dir.unwrap_or(Value::Null));
        let library_dirs = settings.skill_library_dirs.iter().map(|dir| Value::String(dir.display().to_string()));
        object.insert("skillLibraryDirs".to_owned(), Value::Array(library_dirs.collect()));
        object.insert("setupDone".to_owned(), Value::Bool(settings.setup_done));
        if let Some(language) = settings.language {
            object.insert("language".to_owned(), Value::String(language.code().to_owned()));
        }
        object.insert(
            "backendAuthModes".to_owned(),
            serde_json::to_value(&settings.backend_auth_modes).map_err(|e| AppError::Storage(e.to_string()))?,
        );
        self.write(&object).map_err(|e| AppError::Storage(not_saved(&e)))
    }
}

fn auth_modes_of(object: &Map<String, Value>) -> std::collections::BTreeMap<String, String> {
    object
        .get("backendAuthModes")
        .and_then(Value::as_object)
        .map(|modes| {
            ["claude", "codex"]
                .into_iter()
                .filter_map(|backend| {
                    modes
                        .get(backend)
                        .and_then(Value::as_str)
                        .filter(|mode| matches!(*mode, "desktop" | "api"))
                        .map(|mode| (backend.to_owned(), mode.to_owned()))
                })
                .collect()
        })
        .unwrap_or_default()
}

fn unreadable(path: &Path, error: &str) -> String {
    let path = path.display();
    locale::pick([
        format!("{path} を読めません: {error}"),
        format!("Cannot read {path}: {error}"),
        format!("无法读取 {path}：{error}"),
        format!("無法讀取 {path}：{error}"),
        format!("{path}을(를) 읽을 수 없습니다: {error}"),
    ])
}

fn malformed(path: &Path) -> String {
    let path = path.display();
    locale::pick([
        format!("{path} の形が正しくありません"),
        format!("{path} is not in the expected format"),
        format!("{path} 的格式不正确"),
        format!("{path} 的格式不正確"),
        format!("{path}의 형식이 올바르지 않습니다"),
    ])
}

fn not_saved(error: &str) -> String {
    locale::pick([
        format!("設定を保存できませんでした: {error}"),
        format!("Could not save the settings: {error}"),
        format!("无法保存设置：{error}"),
        format!("無法儲存設定：{error}"),
        format!("설정을 저장할 수 없습니다: {error}"),
    ])
}

fn data_dir_of(object: &Map<String, Value>) -> Option<PathBuf> {
    object.get("dataDir").and_then(Value::as_str).map(PathBuf::from)
}

/// 文字列でない要素は無視する
fn library_dirs_of(object: &Map<String, Value>) -> Vec<PathBuf> {
    let items = object.get("skillLibraryDirs").and_then(Value::as_array);
    items.map(|items| items.iter().filter_map(Value::as_str).map(PathBuf::from).collect()).unwrap_or_default()
}
