//! 値の検証（スキル・チャンネル・メッセージ・プロフィール）と ID の文字列表現。

use guild_domain::agent::normalize_tags;
use guild_domain::author::{Author, MemberId};
use guild_domain::channel::{normalize_channel_name, normalize_channel_topic, normalize_members};
use guild_domain::ids::AgentId;
use guild_domain::link::external_url;
use guild_domain::message::normalize_human_content;
use guild_domain::profile::{normalize_profile, Profile};
use guild_domain::skill::{normalize_skill_description, validate_skill_name};

#[test]
fn skill_names_follow_the_agent_skills_standard_without_conversion() {
    for valid in ["code-review", "a", "review2", &"a".repeat(64)] {
        assert!(validate_skill_name(valid).is_ok(), "{valid}");
    }
    let too_long = "a".repeat(65);
    for invalid in ["", "Code-Review", "code review", "-code", "code-", "code--review", "レビュー", too_long.as_str()] {
        let error = validate_skill_name(invalid).expect_err(invalid);
        assert_eq!(error.field(), Some("name"), "{invalid}");
    }
}

#[test]
fn skill_descriptions_are_required_and_limited() {
    assert!(normalize_skill_description("  ").is_err());
    assert_eq!(normalize_skill_description(" 説明 "), Ok("説明".to_owned()));
    let error = normalize_skill_description(&"あ".repeat(1025)).expect_err("長すぎる");
    assert_eq!(error.field(), Some("description"));
}

#[test]
fn channel_names_drop_the_hash_and_blank() {
    assert_eq!(normalize_channel_name(" #雑談 "), Ok("雑談".to_owned()));
    assert!(normalize_channel_name(" # ").is_err());
    assert!(normalize_channel_name(&"あ".repeat(40)).is_ok());
    let error = normalize_channel_name(&"あ".repeat(41)).expect_err("41文字");
    assert_eq!(error.field(), Some("name"));
}

#[test]
fn channel_topics_are_limited_to_200_chars() {
    assert!(normalize_channel_topic(&"あ".repeat(200)).is_ok());
    let error = normalize_channel_topic(&"あ".repeat(201)).expect_err("201文字");
    assert_eq!(error.field(), Some("topic"));
}

#[test]
fn channel_members_always_start_with_the_human() {
    let haru = MemberId::Agent(AgentId::new("haru"));
    let members = normalize_members(&[haru.clone(), MemberId::Human, haru.clone()]);
    assert_eq!(members, vec![MemberId::Human, haru]);
}

#[test]
fn human_messages_are_trimmed_and_required_unless_images_are_attached() {
    assert_eq!(normalize_human_content("  やあ \n", false), Ok("やあ".to_owned()));
    assert!(normalize_human_content(" \n ", false).is_err());
    assert_eq!(normalize_human_content(" \n ", true), Ok(String::new()), "画像だけの発言は本文が空でよい");
}

#[test]
fn profile_names_follow_the_agent_name_rules() {
    let blank = Profile { name: "  ".to_owned(), ..Profile::default() };
    assert!(normalize_profile(blank).is_err());
    let spaced = Profile { name: "ラン ド".to_owned(), ..Profile::default() };
    assert!(normalize_profile(spaced).is_err());
    let named = Profile { name: " ランド ".to_owned(), ..Profile::default() };
    assert_eq!(normalize_profile(named).map(|p| p.name), Ok("ランド".to_owned()));
}

#[test]
fn only_http_and_https_links_are_opened() {
    assert_eq!(external_url(" https://example.com/?a=1&b=2 "), Ok("https://example.com/?a=1&b=2".to_owned()));
    assert!(external_url("HTTP://Example.com").is_ok());
    for bad in ["javascript:alert(1)", "file:///C:/Windows", "mailto:a@b.c", "https://", "https:///path", "https://a b", "ftp://x"] {
        let error = external_url(bad).expect_err(bad);
        assert_eq!(error.field(), Some("url"), "{bad}");
    }
    assert!(external_url(&format!("https://a.example/{}", "x".repeat(2048))).is_err());
}

#[test]
fn authors_and_members_round_trip_through_strings() {
    assert_eq!(Author::from("me".to_owned()), Author::Human);
    assert_eq!(Author::from("system".to_owned()), Author::System);
    assert_eq!(Author::from("a1".to_owned()), Author::Agent(AgentId::new("a1")));
    assert_eq!(String::from(Author::System), "system");
    assert_eq!(MemberId::from("me".to_owned()), MemberId::Human);
    assert_eq!(String::from(MemberId::Agent(AgentId::new("a1"))), "a1");
}

fn tags(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| (*value).to_owned()).collect()
}

#[test]
fn tags_are_trimmed_and_duplicates_merge_after_normalization() {
    let normalized = normalize_tags(&tags(&[" 作業者 ", "Ｒｅｖｉｅｗ", "review", "作業者", "リサーチ"]));
    assert_eq!(normalized, Ok(tags(&["作業者", "Ｒｅｖｉｅｗ", "リサーチ"])));
    assert_eq!(normalize_tags(&[]), Ok(Vec::new()));
    let nine: Vec<String> = (0..9).map(|i| format!("tag{i}")).collect();
    assert!(normalize_tags(&nine).is_err());
    let eight_after_merge: Vec<String> = (0..8).map(|i| format!("tag{i}")).chain(["TAG0".to_owned()]).collect();
    assert_eq!(normalize_tags(&eight_after_merge).map(|t| t.len()), Ok(8), "まとめたあとで数える");
}

#[test]
fn tags_reject_blank_long_and_forbidden_characters() {
    let too_long = "あ".repeat(17);
    for bad in ["", "  ", "作 業", "#作業", "作,業", "作＠業", "作，業", too_long.as_str()] {
        let error = normalize_tags(&tags(&[bad])).expect_err(bad);
        assert_eq!(error.field(), Some("tags"), "{bad}");
    }
    assert!(normalize_tags(&tags(&[&"あ".repeat(16)])).is_ok());
}
