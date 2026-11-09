use guild_domain::conversation::format_reply;

#[test]
fn pass_alone_is_not_posted() {
    assert_eq!(format_reply("[PASS]", "ハル"), None);
    assert_eq!(format_reply("  [PASS]\n", "ハル"), None);
    assert_eq!(format_reply("ハル: [PASS]", "ハル"), None);
    assert_eq!(format_reply("ハル：[PASS]", "ハル"), None);
}

#[test]
fn empty_output_is_not_posted() {
    assert_eq!(format_reply("  \n ", "ハル"), None);
    assert_eq!(format_reply("ハル:", "ハル"), None);
}

#[test]
fn pass_inside_text_is_removed_and_the_rest_is_posted() {
    assert_eq!(
        format_reply("[PASS] と言いたいところですが一言だけ", "ハル"),
        Some("と言いたいところですが一言だけ".to_owned())
    );
    assert_eq!(format_reply("[PASS][PASS]", "ハル"), None);
}

#[test]
fn strips_the_name_prefix() {
    assert_eq!(format_reply("ハル: こんにちは", "ハル"), Some("こんにちは".to_owned()));
    assert_eq!(format_reply("ハル：こんにちは", "ハル"), Some("こんにちは".to_owned()));
}

#[test]
fn keeps_text_that_only_starts_with_the_name() {
    assert_eq!(format_reply("ハルカ: やあ", "ハル"), Some("ハルカ: やあ".to_owned()));
    assert_eq!(format_reply("ハルです。", "ハル"), Some("ハルです。".to_owned()));
}
