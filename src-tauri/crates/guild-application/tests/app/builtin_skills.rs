//! 内蔵スキル（design.md §14）: 一覧・link / copy の追加・一覧と実行での読み直し。

use guild_application::AppError;
use guild_domain::skill::{find_builtin_skill, LibraryAddMode, SkillInput, SkillSource};

use crate::support::runtime::reply;
use crate::support::TestApp;

fn edit_of(skill: &guild_domain::skill::Skill, description: &str) -> SkillInput {
    SkillInput {
        id: Some(skill.id.clone()),
        agent_id: skill.agent_id.clone(),
        name: skill.name.clone(),
        description: description.to_owned(),
        body: String::new(),
    }
}

#[tokio::test]
async fn builtins_are_listed_in_name_order() {
    let app = TestApp::new();
    let names: Vec<String> = app.services.skills.builtins().into_iter().map(|skill| skill.name).collect();
    let mut sorted = names.clone();
    sorted.sort();
    assert_eq!(names, sorted);
    assert!(names.iter().any(|name| name == "introspection"));
}

#[tokio::test]
async fn linked_builtins_are_read_only_and_copies_are_editable() {
    let app = TestApp::new();
    let logica = app.agent("expert", "ロジカ");
    let add = |name: &str, mode| app.services.skills.add_builtin(&logica.id, name, mode);

    let linked = add("introspection", LibraryAddMode::Link).unwrap();
    assert_eq!(linked.source, Some(SkillSource::Builtin { name: "introspection".to_owned() }));
    assert_eq!(linked.body, find_builtin_skill("introspection").unwrap().body);
    let error = app.services.skills.save(edit_of(&linked, "x")).unwrap_err();
    assert!(matches!(error, AppError::Validation(_)), "内蔵スキルの参照は編集できない");
    assert!(matches!(add("introspection", LibraryAddMode::Copy), Err(AppError::Conflict(_))));

    let copied = add("ambiguous-word-rewrite", LibraryAddMode::Copy).unwrap();
    assert_eq!(copied.source, None);
    assert_eq!(app.services.skills.save(edit_of(&copied, "新しい説明")).unwrap().description, "新しい説明");

    assert_eq!(add("no-such-skill", LibraryAddMode::Link), Err(AppError::NotFound("内蔵スキル")));
    let ghost = guild_domain::ids::AgentId::new("ghost");
    let missing_agent = app.services.skills.add_builtin(&ghost, "introspection", LibraryAddMode::Link);
    assert_eq!(missing_agent, Err(AppError::NotFound("エージェント")));
    assert_eq!(app.events.skills_changed.lock().len(), 3);
}

#[tokio::test]
async fn listing_and_runs_reread_builtins_and_skip_ones_this_version_lacks() {
    let app = TestApp::new();
    let haru = app.agent("worker", "ハル");
    let lobby = app.channel("ロビー", &[&haru]);
    app.services.skills.add_builtin(&haru.id, "introspection", LibraryAddMode::Link).unwrap();
    let gone = app.services.skills.add_builtin(&haru.id, "concept-shift", LibraryAddMode::Link).unwrap();
    {
        let mut skills = app.store.skills.lock();
        for skill in skills.iter_mut() {
            if skill.id == gone.id {
                // 古い版で付けた、今の版にはない内蔵スキル
                skill.name = "retired".to_owned();
                skill.source = Some(SkillSource::Builtin { name: "retired".to_owned() });
            } else {
                skill.description = "古い写し".to_owned();
            }
        }
    }

    let listed = app.services.skills.list(&haru.id).unwrap();
    let fresh = find_builtin_skill("introspection").unwrap();
    let by_name = |name: &str| listed.iter().find(|skill| skill.name == name).unwrap();
    assert_eq!(by_name("introspection").description, fresh.description, "今の版の内蔵スキルが正");
    assert_eq!(by_name("retired").problem.as_deref(), Some("内蔵スキル「retired」はこの版のアプリにありません"));

    app.runtime.script(haru.id.as_str(), reply("はい"));
    app.services.conversation.send_human_message(&lobby.id, "お願い", &[]).unwrap();
    app.settle().await;
    let request = &app.runtime.requests_for(haru.id.as_str())[0];
    let skills: Vec<(&str, &str, bool)> =
        request.skills.iter().map(|s| (s.name.as_str(), s.description.as_str(), s.dir.is_none())).collect();
    assert_eq!(skills, [("introspection", fresh.description.as_str(), true)], "読めない内蔵スキルは外す");
}

#[tokio::test]
async fn runs_pass_the_bundled_files_of_builtins() {
    let app = TestApp::new();
    let haru = app.agent("worker", "ハル");
    let lobby = app.channel("ロビー", &[&haru]);
    app.services.skills.add_builtin(&haru.id, "universal-critique", LibraryAddMode::Link).unwrap();
    app.services.skills.add_builtin(&haru.id, "concept-shift", LibraryAddMode::Copy).unwrap();
    app.runtime.script(haru.id.as_str(), reply("はい"));

    app.services.conversation.send_human_message(&lobby.id, "お願い", &[]).unwrap();
    app.settle().await;

    let request = &app.runtime.requests_for(haru.id.as_str())[0];
    let files_of = |name: &str| -> Vec<String> {
        let skill = request.skills.iter().find(|skill| skill.name == name).unwrap();
        skill.files.iter().map(|file| file.path.clone()).collect()
    };
    assert_eq!(files_of("universal-critique"), find_builtin_skill("universal-critique").unwrap().files);
    assert!(files_of("universal-critique").iter().any(|path| path == "references/classical-methods.md"));
    assert!(files_of("concept-shift").is_empty(), "コピーしたスキルは本文だけ（付属ファイルは持たない）");
}
