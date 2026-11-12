//! 内蔵スキル: 同梱の SKILL.md がすべて Agent Skills 標準に合い、フォルダ名と name がそろっていること。付属ファイルも渡せること。

use guild_domain::skill::{builtin_skill_files, builtin_skills, bundled_skills, find_builtin_skill, parse_skill_file};

#[test]
fn every_bundled_skill_file_follows_the_standard_and_matches_its_folder() {
    let bundled = bundled_skills();
    assert!(!bundled.is_empty());
    for skill in bundled {
        let file = parse_skill_file(skill.skill_md, skill.folder);
        assert_eq!(file.problem, None, "{}/SKILL.md が標準に合わない", skill.folder);
        assert_eq!(file.name, skill.folder, "{}/SKILL.md の name がフォルダ名と違う", skill.folder);
        assert!(!file.body.trim().is_empty(), "{}/SKILL.md の本文が空", skill.folder);
        for (path, _) in skill.files {
            let safe = !path.starts_with('/')
                && !path.contains('\\')
                && path.split('/').all(|p| !matches!(p, "" | "." | ".."));
            assert!(safe, "{}: 付属ファイルのパスが相対パスでない（{path}）", skill.folder);
        }
    }
    assert_eq!(builtin_skills().len(), bundled.len(), "すべて一覧に出る");
}

#[test]
fn builtins_are_sorted_unique_and_found_by_name() {
    let names: Vec<String> = builtin_skills().into_iter().map(|skill| skill.name).collect();
    let mut sorted = names.clone();
    sorted.sort();
    sorted.dedup();
    assert_eq!(names, sorted, "name の順で重なりがない");
    assert_eq!(
        names,
        ["ambiguous-word-rewrite", "concept-shift", "introspection", "ornate-avatar-frame", "universal-critique"]
    );
    assert_eq!(find_builtin_skill("introspection").map(|skill| skill.name).as_deref(), Some("introspection"));
    assert_eq!(find_builtin_skill("nothing"), None);
}

#[test]
fn referenced_files_are_bundled_with_their_skill() {
    let critique = find_builtin_skill("universal-critique").expect("universal-critique");
    assert!(critique.files.iter().any(|path| path == "references/classical-methods.md"));
    let files = builtin_skill_files("universal-critique");
    assert_eq!(files.iter().map(|file| file.path.clone()).collect::<Vec<_>>(), critique.files);
    assert!(files.iter().all(|file| !file.content.is_empty()));
    assert!(find_builtin_skill("introspection").expect("introspection").files.is_empty());
    assert!(builtin_skill_files("nothing").is_empty());
}
