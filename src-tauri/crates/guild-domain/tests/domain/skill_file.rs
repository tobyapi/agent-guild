//! SKILL.md の読み取り: frontmatter の name・description と本文、標準に合わないときの problem。

use guild_domain::skill::parse_skill_file;

#[test]
fn reads_name_description_and_body() {
    let text = "---\nname: unity-performance\ndescription: Unity の計測を読むときの手順\nallowed-tools: Read\n---\n\n# 手順\n\n1. 見る\n";
    let file = parse_skill_file(text, "folder");
    assert_eq!(file.name, "unity-performance");
    assert_eq!(file.description, "Unity の計測を読むときの手順");
    assert_eq!(file.body, "# 手順\n\n1. 見る\n");
    assert_eq!(file.problem, None);
}

#[test]
fn reads_quoted_and_block_values_and_skips_nested_keys() {
    let text = "\u{feff}---\r\nname: \"code-review\" \r\nmetadata:\r\n  description: 入れ子は無視\r\n  tags:\r\n    - a\r\ndescription: >-\r\n  差分を読んで\r\n  指摘する\r\n\r\n  ときに使う\r\n---\r\n本文\r\n";
    let file = parse_skill_file(text, "folder");
    assert_eq!(file.name, "code-review");
    assert_eq!(file.description, "差分を読んで 指摘する\nときに使う");
    assert_eq!(file.body, "本文\n");
    assert_eq!(file.problem, None);
}

#[test]
fn reads_literal_single_quoted_and_multiline_plain_values() {
    let literal = parse_skill_file("---\nname: a-b\ndescription: |\n  1行目\n    2行目\n---\n", "f");
    assert_eq!(literal.description, "1行目\n  2行目");
    let single = parse_skill_file("---\nname: 'a-b' # コメント\ndescription: 'it''s ok'\n---\n", "f");
    assert_eq!((single.name.as_str(), single.description.as_str()), ("a-b", "it's ok"));
    let plain = parse_skill_file("---\nname: a-b\ndescription: 長い説明が\n  次の行に続く # 注\n---\n", "f");
    assert_eq!(plain.description, "長い説明が 次の行に続く");
    let escaped = parse_skill_file("---\nname: a-b\ndescription: \"引用 \\\"内\\\"\\n改行\"\n---\n", "f");
    assert_eq!(escaped.description, "引用 \"内\"\n改行");
}

#[test]
fn reports_name_and_description_problems_together() {
    let file = parse_skill_file("---\nname: Draft Notes\n---\n本文", "Draft Notes");
    assert_eq!(file.name, "Draft Notes");
    assert_eq!(file.description, "");
    assert_eq!(
        file.problem.as_deref(),
        Some("name が Agent Skills の形式（英小文字・数字・ハイフン）ではありません。description がありません。")
    );
}

#[test]
fn missing_name_falls_back_to_the_folder_name() {
    let file = parse_skill_file("---\ndescription: 説明\nname: ~\n---\n", "my-skill");
    assert_eq!(file.name, "my-skill");
    assert_eq!(file.problem.as_deref(), Some("name がありません。"));
}

#[test]
fn too_long_description_is_a_problem() {
    let text = format!("---\nname: a\ndescription: {}\n---\n", "あ".repeat(1025));
    let file = parse_skill_file(&text, "a");
    assert_eq!(file.description.chars().count(), 1025);
    assert_eq!(file.problem.as_deref(), Some("description が1024文字を超えています。"));
}

#[test]
fn without_frontmatter_the_whole_text_is_the_body() {
    let file = parse_skill_file("\n# メモ\nname: x\n", "notes");
    assert_eq!(file.name, "notes");
    assert_eq!(file.body, "# メモ\nname: x\n");
    assert!(file.problem.as_deref().is_some_and(|p| p.contains("frontmatter")));
    let unclosed = parse_skill_file("---\nname: a\ndescription: b\n", "a");
    assert_eq!(unclosed.problem.as_deref(), Some("frontmatter が --- で閉じられていません。"));
}
