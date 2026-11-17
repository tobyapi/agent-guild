use super::TempDir;
use crate::infrastructure::settings::SettingsFile;
use guild_application::ports::SettingsStore;
use std::fs;

#[test]
fn notification_settings_preserve_old_and_unknown_fields_and_roundtrip_disabled() {
    let dir = TempDir::new("notification-settings");
    let file = dir.0.join("settings.json");
    fs::write(&file, r#"{"version":1,"dataDir":null,"futureField":{"keep":true}}"#).unwrap();
    let store = SettingsFile::in_dir(&dir.0);
    let mut loaded = store.load().unwrap();
    assert_eq!(loaded.desktop_notifications, None);
    loaded.desktop_notifications = Some(false);
    store.save(&loaded).unwrap();
    assert_eq!(store.load().unwrap().desktop_notifications, Some(false));
    let object: serde_json::Value = serde_json::from_str(&fs::read_to_string(&file).unwrap()).unwrap();
    assert_eq!(object["futureField"]["keep"], true);
    assert_eq!(object["version"], 1);
    fs::write(&file, r#"{"version":999,"desktopNotifications":false}"#).unwrap();
    let before = fs::read(&file).unwrap();
    assert!(store.save(&loaded).is_err());
    assert_eq!(fs::read(&file).unwrap(), before);
}
