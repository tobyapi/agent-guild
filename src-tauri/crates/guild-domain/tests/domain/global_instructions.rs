use guild_domain::prompt::{global_instructions_section, validate_global_instructions, GLOBAL_INSTRUCTIONS_LIMIT};

#[test]
fn empty_instructions_preserve_every_byte() {
    assert_eq!(global_instructions_section(""), "");
}

#[test]
fn instructions_are_bounded_constant_user_guidance() {
    let prompt = global_instructions_section("共有の約束");
    assert!(prompt.starts_with("## 全エージェント共通の指示\n"));
    assert!(prompt.contains("外部の参照資料ではありません"));
    assert!(prompt.find("1. アプリ固有").unwrap() < prompt.find("2. 各エージェント").unwrap());
    assert!(prompt.find("2. 各エージェント").unwrap() < prompt.find("3. この共通").unwrap());
    assert!(prompt.ends_with("## 共通の指示の終わり\n"));
    assert_eq!(prompt.matches("共有の約束").count(), 1);
}

#[test]
fn instructions_limit_counts_utf16_including_emoji_without_truncating() {
    assert!(validate_global_instructions(&"あ".repeat(GLOBAL_INSTRUCTIONS_LIMIT)).is_ok());
    assert!(validate_global_instructions(&"あ".repeat(GLOBAL_INSTRUCTIONS_LIMIT + 1)).is_err());
    assert!(validate_global_instructions(&"😀".repeat(GLOBAL_INSTRUCTIONS_LIMIT / 2)).is_ok());
    assert!(validate_global_instructions(&"😀".repeat(GLOBAL_INSTRUCTIONS_LIMIT / 2 + 1)).is_err());
}
