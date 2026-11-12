//! ギルドのプロフィール（名前と紋）の検証と、保存値の読み取り。

use guild_domain::guild::{normalize_guild, read_stored_guild, CrestColor, CrestShape, GuildCrest, GuildProfile};

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

#[test]
fn stored_guilds_are_read_back() {
    let guild = GuildProfile {
        name: "灯の団".to_owned(),
        crest: GuildCrest { shape: CrestShape::Star, color: CrestColor::Jade },
    };
    let raw = serde_json::to_string(&guild).unwrap();
    assert_eq!(read_stored_guild(Some(&raw)), guild);
}

#[test]
fn missing_or_broken_values_read_as_the_default() {
    assert_eq!(read_stored_guild(None), GuildProfile::default());
    assert_eq!(read_stored_guild(Some("{壊れた")), GuildProfile::default());
    assert_eq!(read_stored_guild(Some("[1, 2]")), GuildProfile::default());
}

#[test]
fn unknown_parts_fall_back_one_by_one() {
    let raw = r#"{ "name": "灯の団", "crest": { "shape": "dragon", "color": "violet" }, "motto": "新しい版の項目" }"#;
    let guild = read_stored_guild(Some(raw));
    assert_eq!(guild.name, "灯の団");
    assert_eq!(guild.crest, GuildCrest { shape: CrestShape::Diamond, color: CrestColor::Violet });
    let too_long = format!(r#"{{ "name": "{}", "crest": {{ "shape": "shield" }} }}"#, "あ".repeat(40));
    let guild = read_stored_guild(Some(&too_long));
    assert_eq!(guild.name, "");
    assert_eq!(guild.crest.shape, CrestShape::Shield);
    assert_eq!(guild.crest.color, CrestColor::Default);
}
