use guild_domain::agent::Agent;
use guild_domain::conversation::parse_mentions;

use super::support::{agent, ids};

fn agents() -> Vec<Agent> {
    let mut gone = agent("gone", "worker", "ゴースト");
    gone.deleted_at = Some(1);
    vec![
        agent("haru", "worker", "ハル"),
        agent("haruka", "worker", "ハルカ"),
        agent("sora", "worker", "ソラ"),
        agent("logica", "expert", "ロジカ"),
        agent("gear", "expert", "Gear"),
        gone,
    ]
}

#[test]
fn finds_a_simple_mention() {
    assert_eq!(parse_mentions("@ソラ お願いします", &agents()), ids(&["sora"]));
}

#[test]
fn normalizes_full_width_at_sign_and_letters() {
    assert_eq!(parse_mentions("＠ロジカ 見てください", &agents()), ids(&["logica"]));
    assert_eq!(parse_mentions("＠ＧＥＡＲ よろしく", &agents()), ids(&["gear"]));
}

#[test]
fn ignores_case() {
    assert_eq!(parse_mentions("@gear と @GEAR", &agents()), ids(&["gear"]));
}

#[test]
fn ignores_mentions_inside_code_blocks() {
    let content = "例:\n```\n@ハル を呼ぶ\n```\n@ソラ どう？";
    assert_eq!(parse_mentions(content, &agents()), ids(&["sora"]));
}

#[test]
fn treats_an_unclosed_code_block_as_code_until_the_end() {
    assert_eq!(parse_mentions("@ソラ ```\n@ハル", &agents()), ids(&["sora"]));
}

#[test]
fn prefers_the_longest_name() {
    assert_eq!(parse_mentions("@ハルカ さん", &agents()), ids(&["haruka"]));
    assert_eq!(parse_mentions("@ハルカ と @ハル", &agents()), ids(&["haruka", "haru"]));
}

#[test]
fn matches_names_followed_by_japanese_text() {
    assert_eq!(parse_mentions("@ハルさん、調べて", &agents()), ids(&["haru"]));
}

#[test]
fn returns_mentions_in_order_of_appearance_without_duplicates() {
    let content = "@ソラ と @ロジカ、それと @ソラ";
    assert_eq!(parse_mentions(content, &agents()), ids(&["sora", "logica"]));
}

#[test]
fn ignores_deleted_agents_unknown_names_and_bare_names() {
    assert!(parse_mentions("@ゴースト @だれか ソラ ハル", &agents()).is_empty());
}
