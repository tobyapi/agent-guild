//! チャンネルのアイコンの規則。TS（src/shared/lib/channelIcon.ts）と共通の実例
//! （contracts/behavior/channel-icons.json）で検査する。

use std::fs;
use std::path::PathBuf;

use guild_domain::channel::normalize_channel_icon;
use serde_json::Value;

#[test]
fn channel_icons_follow_the_shared_examples() {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../contracts/behavior/channel-icons.json");
    let text = fs::read_to_string(&path).unwrap_or_else(|e| panic!("{} を読めません: {e}", path.display()));
    let cases: Vec<Value> = serde_json::from_str(&text).unwrap();
    assert!(!cases.is_empty());
    for case in &cases {
        let icon = case["icon"].as_str().unwrap();
        let expected = case["result"].as_str();
        let actual = normalize_channel_icon(icon).ok();
        assert_eq!(actual.as_deref(), expected, "{}", case["name"]);
    }
}

#[test]
fn invalid_icons_name_the_icon_field() {
    let error = normalize_channel_icon("ab").expect_err("英字");
    assert_eq!(error.field(), Some("icon"));
}
