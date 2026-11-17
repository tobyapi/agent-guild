//! 起動設定ファイルと作業場所。

use std::fs;
use std::path::PathBuf;

use guild_application::ports::{LaunchSettings, SettingsStore, Workspace};
use guild_domain::ids::AgentId;
use guild_domain::locale::Language;
use serde_json::{json, Value};

use super::TempDir;
use crate::infrastructure::settings::SettingsFile;
use crate::infrastructure::workspace::FsWorkspace;

fn read_json(path: &std::path::Path) -> Value {
    serde_json::from_str(&fs::read_to_string(path).unwrap()).unwrap()
}

#[test]
fn settings_keep_unknown_fields_and_write_null_for_the_default() {
    let config = TempDir::new("settings");
    let path = config.0.join("settings.json");
    let settings = SettingsFile::in_dir(&config.0);
    assert_eq!(settings.load().unwrap(), LaunchSettings::default(), "ファイルがなければ既定");

    fs::write(&path, r#"{ "version": 1, "dataDir": null, "theme": "dark" }"#).unwrap();
    let chosen = LaunchSettings {
        data_dir: Some(PathBuf::from("D:\\GuildData")),
        skill_library_dirs: vec![PathBuf::from("D:\\skills"), PathBuf::from("E:\\shared-skills")],
        setup_done: true,
        language: Some(Language::ZhHant),
        desktop_notifications: None,
        backend_auth_modes: [("claude".to_owned(), "api".to_owned())].into_iter().collect(),
    };
    settings.save(&chosen).unwrap();
    let expected = json!({
        "version": 1,
        "dataDir": "D:\\GuildData",
        "skillLibraryDirs": ["D:\\skills", "E:\\shared-skills"],
        "setupDone": true,
        "language": "zh-Hant",
        "backendAuthModes": {"claude": "api"},
        "theme": "dark"
    });
    assert_eq!(read_json(&path), expected);
    assert_eq!(settings.load().unwrap(), chosen);

    settings.save(&LaunchSettings::default()).unwrap();
    assert_eq!(read_json(&path)["dataDir"], Value::Null);
    assert_eq!(read_json(&path)["skillLibraryDirs"], json!([]));
    assert_eq!(read_json(&path)["setupDone"], json!(false));
    assert_eq!(read_json(&path)["language"], json!("zh-Hant"), "言語を持たない保存では書き換えない");
}

#[test]
fn a_missing_or_unknown_language_reads_as_none() {
    let config = TempDir::new("language");
    let path = config.0.join("settings.json");
    let settings = SettingsFile::in_dir(&config.0);
    fs::write(&path, r#"{ "version": 1, "dataDir": null, "setupDone": true }"#).unwrap();
    assert_eq!(settings.load().unwrap().language, None, "言語の設定がなかった版のファイル");
    for odd in [r#""fr""#, "3", "null"] {
        fs::write(&path, format!(r#"{{ "version": 1, "language": {odd} }}"#)).unwrap();
        assert_eq!(settings.load().unwrap().language, None, "{odd}");
    }
    fs::write(&path, r#"{ "version": 1, "language": "ko" }"#).unwrap();
    assert_eq!(settings.load().unwrap().language, Some(Language::Ko));
}

#[test]
fn backend_auth_modes_round_trip_and_ignore_invalid_values() {
    let config = TempDir::new("auth-modes");
    let path = config.0.join("settings.json");
    let settings = SettingsFile::in_dir(&config.0);
    fs::write(
        &path,
        r#"{"version":1,"backendAuthModes":{"claude":"api","codex":"desktop","grok":"api","muse":"invalid"}}"#,
    )
    .unwrap();
    let loaded = settings.load().unwrap();
    assert_eq!(loaded.backend_auth_modes.len(), 2);
    assert_eq!(loaded.backend_auth_modes.get("claude").map(String::as_str), Some("api"));
    settings.save(&loaded).unwrap();
    assert_eq!(read_json(&path)["backendAuthModes"], json!({"claude":"api","codex":"desktop"}));
}

#[test]
fn settings_from_a_newer_app_are_not_rewritten() {
    let config = TempDir::new("newer");
    let path = config.0.join("settings.json");
    fs::write(&path, r#"{ "version": 2, "dataDir": "E:\\Guild" }"#).unwrap();
    let settings = SettingsFile::in_dir(&config.0);
    assert_eq!(settings.load().unwrap().data_dir, Some(PathBuf::from("E:\\Guild")), "読むことはできる");
    assert!(settings.save(&LaunchSettings::default()).is_err());
    assert_eq!(read_json(&path)["version"], json!(2));
}

#[test]
fn the_state_folder_is_recreated_for_every_run() {
    let data = TempDir::new("workspace");
    let workspace = FsWorkspace::new(&data.0);
    let agent = AgentId::new("a1");
    let paths = workspace.prepare(&agent, "claude").unwrap();
    assert_eq!(paths.work, data.0.join("agents").join("a1").join("work"));
    assert_eq!(paths.state, data.0.join("agents").join("a1").join("state").join("claude"));
    fs::write(paths.state.join("settings.json"), "{}").unwrap();
    fs::write(paths.work.join("MEMORY.md"), "覚えておくこと").unwrap();

    let again = workspace.prepare(&agent, "claude").unwrap();
    assert!(!again.state.join("settings.json").exists(), "state は作り直す");
    assert_eq!(workspace.read_memory(&agent).unwrap(), "覚えておくこと", "work は残す");
    let odd = workspace.prepare(&agent, "../evil").unwrap();
    assert!(odd.state.starts_with(data.0.join("agents").join("a1").join("state")), "外に出ない");
}

#[test]
fn memory_is_empty_until_written_and_removal_deletes_everything() {
    let data = TempDir::new("remove");
    let workspace = FsWorkspace::new(&data.0);
    let agent = AgentId::new("a1");
    assert_eq!(workspace.read_memory(&agent).unwrap(), "");
    workspace.prepare(&agent, "codex").unwrap();
    workspace.remove(&agent).unwrap();
    assert!(!data.0.join("agents").join("a1").exists());
    workspace.remove(&agent).unwrap();
}

#[test]
fn preparing_shared_workspace_leaves_retired_channel_data_untouched() {
    let data = TempDir::new("retired-channel-data");
    let legacy = data.0.join("agents/a/channels/c/7");
    fs::create_dir_all(legacy.join("work")).unwrap();
    fs::create_dir_all(legacy.join("state/codex")).unwrap();
    fs::write(legacy.join("work/MEMORY.md"), "legacy memory").unwrap();
    fs::write(legacy.join("state/codex/session"), "legacy session").unwrap();
    let workspace = FsWorkspace::new(&data.0);
    let paths = workspace.prepare(&AgentId::new("a"), "codex").unwrap();
    assert_eq!(paths.work, data.0.join("agents/a/work"));
    assert_eq!(workspace.read_memory(&AgentId::new("a")).unwrap(), "");
    assert_eq!(fs::read_to_string(legacy.join("work/MEMORY.md")).unwrap(), "legacy memory");
    assert_eq!(fs::read_to_string(legacy.join("state/codex/session")).unwrap(), "legacy session");
}
