//! 内蔵スキル: 同梱の SKILL.md がすべて Agent Skills 標準に合い、フォルダ名と name がそろっていること。付属ファイルも渡せること。

use guild_domain::agent::find_template;
use guild_domain::skill::{builtin_skill_files, builtin_skills, bundled_skills, find_builtin_skill, parse_skill_file};

#[test]
fn manager_template_includes_reflection() {
    let manager = find_template("manager").expect("manager template");
    assert_eq!(manager.builtin_skills, ["universal-manager", "reflection"]);
}

const IMPORTED_BUILTIN_NAMES: [&str; 6] = [
    "ambiguous-word-rewrite",
    "concept-shift",
    "introspection",
    "reflection",
    "universal-critique",
    "universal-manager",
];

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
        [
            "ambiguous-word-rewrite",
            "concept-shift",
            "introspection",
            "ornate-avatar-frame",
            "reflection",
            "universal-critique",
            "universal-manager",
        ]
    );
    assert_eq!(find_builtin_skill("introspection").map(|skill| skill.name).as_deref(), Some("introspection"));
    assert_eq!(find_builtin_skill("nothing"), None);
}

#[test]
fn imported_builtins_exclude_source_notes_and_urls() {
    for name in IMPORTED_BUILTIN_NAMES {
        let skill = bundled_skills().iter().find(|skill| skill.folder == name).expect(name);
        assert!(
            skill.files.iter().all(|(path, _)| path.rsplit('/').next() != Some("source-notes.md")),
            "{name}: source-notes.md は同梱しない"
        );
        for (path, content) in std::iter::once(("SKILL.md", skill.skill_md)).chain(skill.files.iter().copied()) {
            assert!(
                !content.contains("http://") && !content.contains("https://"),
                "{name}/{path}: 出典の URL は同梱しない"
            );
        }
    }
}

#[test]
fn imported_builtins_exclude_source_author_names() {
    const SOURCE_AUTHOR_NAMES: [&str; 12] = [
        "ソクラテス",
        "ポパー",
        "アルトシュラー",
        "ボーデン",
        "ヴェルフリン",
        "ウリポ",
        "墨家",
        "de Bono",
        "Boden",
        "Aristotle",
        "Popper",
        "Woelfflin",
    ];
    for name in IMPORTED_BUILTIN_NAMES {
        let skill = bundled_skills().iter().find(|skill| skill.folder == name).expect(name);
        for (path, content) in std::iter::once(("SKILL.md", skill.skill_md)).chain(skill.files.iter().copied()) {
            let lowercase = content.to_lowercase();
            for author in SOURCE_AUTHOR_NAMES {
                assert!(
                    !lowercase.contains(&author.to_lowercase()),
                    "{name}/{path}: 出典の人名・団体名（{author}）は同梱しない"
                );
            }
        }
    }
}

#[test]
fn referenced_files_are_bundled_with_their_skill() {
    let critique = find_builtin_skill("universal-critique").expect("universal-critique");
    assert!(critique.files.iter().any(|path| path == "references/classical-methods.md"));
    let files = builtin_skill_files("universal-critique");
    assert_eq!(files.iter().map(|file| file.path.clone()).collect::<Vec<_>>(), critique.files);
    assert!(files.iter().all(|file| !file.content.is_empty()));
    assert!(find_builtin_skill("introspection").expect("introspection").files.is_empty());
    assert_eq!(find_builtin_skill("reflection").expect("reflection").files, ["references/examples.md"]);
    assert_eq!(
        find_builtin_skill("universal-manager").expect("universal-manager").files,
        ["references/ROUTING.md", "references/SCENARIOS.md"]
    );
    assert!(builtin_skill_files("nothing").is_empty());
}
