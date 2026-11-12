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
    };
    settings.save(&chosen).unwrap();
    let expected = json!({
        "version": 1,
        "dataDir": "D:\\GuildData",
        "skillLibraryDirs": ["D:\\skills", "E:\\shared-skills"],
        "setupDone": true,
        "language": "zh-Hant",
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
fn scoped_workspaces_separate_agents_channels_revisions_and_memories() {
    use guild_domain::channel::{ChannelWorkspace, WorkspaceMode};
    use guild_domain::ids::ChannelId;
    let data = TempDir::new("scoped-data");
    let project = TempDir::new("scoped-project");
    let workspace = FsWorkspace::new(&data.0);
    let a = AgentId::new("a");
    let channel = ChannelId::new("c");
    let folder = workspace.validate_folder(project.0.to_str().unwrap()).unwrap();
    // 保存するのは普通の形のパス（Windows の `\\?\` つきではない）。確かめ直しても同じになる
    assert!(!folder.starts_with(r"\\?\"), "{folder}");
    assert_eq!(workspace.validate_folder(&folder).unwrap(), folder);
    let mut scope = ChannelWorkspace { mode: WorkspaceMode::Folder, folder: Some(folder), revision: 1, after_seq: 0 };
    let first = workspace.prepare_scoped(&a, "ollama", &channel, &scope).unwrap();
    fs::write(first.work.join("MEMORY.md"), "channel memory").unwrap();
    fs::write(first.state.join("session"), "old state").unwrap();
    let again = workspace.prepare_scoped(&a, "ollama", &channel, &scope).unwrap();
    assert!(!again.state.join("session").exists());
    assert_eq!(workspace.read_scoped_memory(&a, &channel, 1).unwrap(), "channel memory");
    scope.revision = 2;
    let second = workspace.prepare_scoped(&a, "ollama", &channel, &scope).unwrap();
    assert_ne!(first.work, second.work);
    assert_eq!(workspace.read_scoped_memory(&a, &channel, 2).unwrap(), "");
    assert_ne!(workspace.scoped_work_dir(&AgentId::new("b"), &channel, 2), second.work);
    assert_ne!(workspace.scoped_work_dir(&a, &ChannelId::new("other"), 2), second.work);
    assert!(workspace.validate_folder(data.0.to_str().unwrap()).is_err());
    assert!(workspace.validate_folder(data.0.parent().unwrap().to_str().unwrap()).is_err());
    assert!(workspace.validate_folder("relative").is_err());
}
