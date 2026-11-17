use super::TempDir;
use crate::infrastructure::settings::SettingsFile;
use guild_application::global_instructions::GlobalInstructionsService;
use guild_application::ports::SettingsStore;
use std::{fs, sync::Arc};

#[test]
fn global_instructions_roundtrip_old_settings_unknown_fields_and_clear() {
    let dir = TempDir::new("global-instructions");
    let path = dir.0.join("settings.json");
    fs::write(&path, r#"{"version":1,"dataDir":null,"futureField":{"keep":true}}"#).unwrap();
    let service = GlobalInstructionsService::new(Arc::new(SettingsFile::in_dir(&dir.0)));
    assert_eq!(service.get().unwrap(), "");
    service.set("# 常設\n日本語 😀\n".to_owned()).unwrap();
    let reopened = GlobalInstructionsService::new(Arc::new(SettingsFile::in_dir(&dir.0)));
    assert_eq!(reopened.get().unwrap(), "# 常設\n日本語 😀\n");
    let object: serde_json::Value = serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
    assert_eq!(object["futureField"]["keep"], true);
    let before = fs::read(&path).unwrap();
    assert!(service.set("a".repeat(4_001)).is_err());
    assert_eq!(fs::read(&path).unwrap(), before);
    service.set(String::new()).unwrap();
    assert_eq!(SettingsFile::in_dir(&dir.0).load().unwrap().global_instructions, "");
    fs::write(&path, r#"{"version":999,"globalInstructions":"future"}"#).unwrap();
    let before = fs::read(&path).unwrap();
    assert!(service.set("replacement".to_owned()).is_err());
    assert_eq!(fs::read(&path).unwrap(), before);
}
