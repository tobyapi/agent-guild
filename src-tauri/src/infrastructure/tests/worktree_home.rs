use super::TempDir;
use crate::infrastructure::settings::SettingsFile;
use guild_application::worktree_home::WorktreeHomeService;
use std::{fs, path::Path, sync::Arc};

const DATA_DIR: &str = r"D:\guild-data";
const DEFAULT_HOME: &str = r"D:\guild-data\worktrees";
const CHOSEN: &str = r"E:\wt";

fn service(config: &Path) -> WorktreeHomeService {
    WorktreeHomeService::new(Arc::new(SettingsFile::in_dir(config)), Path::new(DATA_DIR))
}

fn read_json(path: &Path) -> serde_json::Value {
    serde_json::from_str(&fs::read_to_string(path).unwrap()).unwrap()
}

#[test]
fn worktree_home_roundtrips_through_settings_json_and_clears_back_to_the_default() {
    let dir = TempDir::new("worktree-home");
    let path = dir.0.join("settings.json");
    fs::write(&path, r#"{"version":1,"dataDir":null,"futureField":{"keep":true}}"#).unwrap();
    let home = service(&dir.0).get().unwrap();
    assert_eq!((home.path, home.default_path.as_str()), (None, DEFAULT_HOME));

    service(&dir.0).set(Some(CHOSEN.to_owned())).unwrap();
    let object = read_json(&path);
    assert_eq!(object["worktreeHome"].as_str(), Some(CHOSEN));
    assert_eq!(object["futureField"]["keep"].as_bool(), Some(true), "未知の項目は残す");
    let reopened = service(&dir.0);
    assert_eq!(reopened.get().unwrap().path.as_deref(), Some(CHOSEN));
    assert_eq!(reopened.effective(), CHOSEN);

    let before = fs::read(&path).unwrap();
    assert!(reopened.set(Some(r"relative\wt".to_owned())).is_err());
    assert_eq!(fs::read(&path).unwrap(), before, "拒否したらファイルを変えない");

    reopened.set(None).unwrap();
    assert!(read_json(&path).get("worktreeHome").is_none(), "既定に戻したら項目を消す");
    assert_eq!(service(&dir.0).effective(), DEFAULT_HOME);
}
