//! スキルライブラリのフォルダの指定の検証: 絶対パス・重複なし・入れ子なし。

use guild_domain::skill::validate_library_dirs;

fn dirs(items: &[&str]) -> Vec<String> {
    items.iter().map(|item| (*item).to_owned()).collect()
}

fn root(name: &str) -> String {
    if cfg!(windows) {
        format!("D:\\{name}")
    } else {
        format!("/{name}")
    }
}

#[test]
fn accepts_separate_absolute_folders_and_trims_them() {
    let input = dirs(&[&format!(" {} ", root("skills")), &root("skills2"), &root("shared")]);
    let valid = validate_library_dirs(&input).expect("通る");
    assert_eq!(valid, dirs(&[&root("skills"), &root("skills2"), &root("shared")]));
    assert_eq!(validate_library_dirs(&[]).expect("空も通る"), Vec::<String>::new());
}

#[test]
fn rejects_relative_paths() {
    let error = validate_library_dirs(&dirs(&["skills"])).expect_err("相対パス");
    assert_eq!(error.field(), Some("dirs"));
    assert!(error.message().contains("絶対パス"));
}

#[test]
fn rejects_duplicates_even_with_a_trailing_separator() {
    let input = dirs(&[&root("skills"), &format!("{}{}", root("skills"), std::path::MAIN_SEPARATOR)]);
    let error = validate_library_dirs(&input).expect_err("重複");
    assert!(error.message().contains("重複"));
}

#[test]
fn rejects_nested_folders_in_either_order() {
    let nested = format!("{}{}team", root("skills"), std::path::MAIN_SEPARATOR);
    for input in [dirs(&[&root("skills"), &nested]), dirs(&[&nested, &root("skills")])] {
        let error = validate_library_dirs(&input).expect_err("入れ子");
        assert!(error.message().contains("入れ子"), "{}", error.message());
    }
}

#[cfg(windows)]
#[test]
fn compares_without_case_on_windows() {
    let error = validate_library_dirs(&dirs(&["D:\\Skills", "d:/skills"])).expect_err("重複");
    assert!(error.message().contains("重複"));
}
