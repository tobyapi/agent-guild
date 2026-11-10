//! 内蔵スキル: 同梱の SKILL.md がすべて Agent Skills 標準に合い、フォルダ名と name がそろっていること。

use guild_domain::skill::{builtin_skill_files, builtin_skills, find_builtin_skill, parse_skill_file};

#[test]
fn every_bundled_skill_file_follows_the_standard_and_matches_its_folder() {
    let files = builtin_skill_files();
    assert!(!files.is_empty());
    for (folder, text) in files {
        let file = parse_skill_file(text, folder);
        assert_eq!(file.problem, None, "{folder}/SKILL.md が標準に合わない");
        assert_eq!(file.name, *folder, "{folder}/SKILL.md の name がフォルダ名と違う");
        assert!(!file.body.trim().is_empty(), "{folder}/SKILL.md の本文が空");
    }
    assert_eq!(builtin_skills().len(), files.len(), "すべて一覧に出る");
}

#[test]
fn builtins_are_sorted_unique_and_found_by_name() {
    let names: Vec<String> = builtin_skills().into_iter().map(|skill| skill.name).collect();
    let mut sorted = names.clone();
    sorted.sort();
    sorted.dedup();
    assert_eq!(names, sorted, "name の順で重なりがない");
    assert_eq!(find_builtin_skill("code-review").map(|skill| skill.name).as_deref(), Some("code-review"));
    assert_eq!(find_builtin_skill("nothing"), None);
}
