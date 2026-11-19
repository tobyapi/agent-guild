//! ギルドのプロフィール（名前と紋）の入力規則と既定値。

use guild_domain::guild::{normalize_guild, CrestColor, CrestShape, GuildCrest, GuildProfile};

fn named(name: &str) -> GuildProfile {
    GuildProfile { name: name.to_owned(), ..GuildProfile::default() }
}

#[test]
fn guild_names_are_trimmed_may_be_empty_and_are_limited() {
    assert_eq!(normalize_guild(named("  灯の団 ")).unwrap().name, "灯の団");
    assert_eq!(normalize_guild(named("   ")).unwrap().name, "", "空はアプリ名を使う印");
    assert!(normalize_guild(named(&"あ".repeat(32))).is_ok());
    let error = normalize_guild(named(&"あ".repeat(33))).expect_err("33文字");
    assert_eq!(error.field(), Some("name"));
}

#[test]
fn the_default_crest_is_todays_diamond() {
    let guild = GuildProfile::default();
    assert_eq!(guild.crest, GuildCrest { shape: CrestShape::Diamond, color: CrestColor::Default });
    let json = serde_json::to_value(&guild).unwrap();
    assert_eq!(json, serde_json::json!({ "name": "", "crest": { "shape": "diamond", "color": "default" } }));
}
