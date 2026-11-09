//! スキルライブラリ（design.md §14）: 走査・フォルダの指定・link / copy の追加・linked の読み直し・実行への受け渡し。

use std::path::PathBuf;
use std::sync::atomic::Ordering;

use guild_application::AppError;
use guild_domain::skill::{LibraryAddMode, SkillInput, SkillSource};
use guild_domain::storage::DataDirMode;

use crate::support::library::abs;
use crate::support::runtime::reply;
use crate::support::TestApp;

fn skill_md(name: &str, description: &str) -> String {
    format!("---\nname: {name}\ndescription: {description}\n---\n\n# {name} の手順\n")
}

#[tokio::test]
async fn the_library_lists_skills_in_folder_order_and_reports_problems() {
    let app = TestApp::new();
    app.library.put(&abs("skills"), &abs("skills/zeta"), &skill_md("zeta", "Z の説明"), 2);
    app.library.put(&abs("skills"), &abs("skills/Draft Notes"), "---\nname: Draft Notes\n---\n", 0);
    app.library.put(&abs("skills"), &abs("skills/alpha"), &skill_md("alpha", "A の説明"), 0);
    app.library.put(&abs("team"), &abs("team/beta"), &skill_md("beta", "B の説明"), 1);
    let dirs = [abs("team"), abs("skills"), abs("missing")];

    let library = app.services.library.set_dirs(&dirs).unwrap();

    let names: Vec<&str> = library.skills.iter().map(|s| s.name.as_str()).collect();
    assert_eq!(names, ["beta", "Draft Notes", "alpha", "zeta"], "dirs の順、フォルダの中は name の順");
    assert_eq!(library.dirs, dirs);
    assert_eq!(library.skills[0].library_dir, abs("team"));
    assert_eq!(library.skills[3].file_count, 2);
    assert!(library.skills[1].problem.as_deref().is_some_and(|p| p.contains("description がありません")));
    assert_eq!(library.skills[2].problem, None);
    assert_eq!(library.dir_problems.get(&abs("missing")).map(String::as_str), Some("フォルダが見つかりません"));
    assert_eq!(app.events.library_changes.load(Ordering::SeqCst), 1);
    let saved = app.settings.saved.lock().last().cloned().unwrap().skill_library_dirs;
    assert_eq!(saved, dirs.iter().map(PathBuf::from).collect::<Vec<_>>());
    assert_eq!(app.services.library.get().unwrap(), library, "get は保存した指定で走査し直す");
}

#[tokio::test]
async fn invalid_dirs_are_rejected_without_saving() {
    let app = TestApp::new();
    let nested = [abs("skills"), abs("skills/team")];
    for dirs in [vec!["skills".to_owned()], nested.to_vec(), vec![abs("a"), abs("a")]] {
        let error = app.services.library.set_dirs(&dirs).expect_err("通らない");
        assert_eq!(error.to_command_error().field.as_deref(), Some("dirs"));
    }
    assert!(app.settings.saved.lock().is_empty());
    assert_eq!(app.events.library_changes.load(Ordering::SeqCst), 0);
}

#[tokio::test]
async fn the_scan_stops_at_500_skills_across_folders() {
    let app = TestApp::new();
    for i in 0..501 {
        app.library.put(&abs("big"), &abs(&format!("big/s{i:03}")), &skill_md(&format!("s{i:03}"), "説明"), 0);
    }
    app.library.put(&abs("small"), &abs("small/one"), &skill_md("one", "説明"), 0);
    let library = app.services.library.set_dirs(&[abs("big"), abs("small")]).unwrap();
    assert_eq!(library.skills.len(), 500);
    assert!(library.dir_problems.values().all(|p| p.contains("500件で打ち切りました")));
    assert_eq!(library.dir_problems.len(), 2);
}

#[tokio::test]
async fn linked_and_copied_skills_are_added_once_per_name() {
    let app = TestApp::new();
    let logica = app.agent("expert", "ロジカ");
    app.library.put(&abs("skills"), &abs("skills/unity"), &skill_md("unity", "Unity の手順"), 3);
    app.library.put(&abs("skills"), &abs("skills/review"), &skill_md("review", "レビューの手順"), 0);
    let add = |path: &str, mode| app.services.library.add(&logica.id, path, mode);

    let linked = add(&abs("skills/unity"), LibraryAddMode::Link).unwrap();
    assert_eq!(linked.source, Some(SkillSource::Linked { path: abs("skills/unity") }));
    assert_eq!((linked.description.as_str(), linked.body.as_str()), ("Unity の手順", "# unity の手順\n"));
    let edit = SkillInput { id: Some(linked.id.clone()), agent_id: logica.id.clone(), name: "unity".to_owned(), description: "x".to_owned(), body: String::new() };
    assert!(matches!(app.services.skills.save(edit), Err(AppError::Validation(_))), "linked は編集できない");
    assert!(matches!(add(&abs("skills/unity"), LibraryAddMode::Copy), Err(AppError::Conflict(_))));

    let copied = add(&abs("skills/review"), LibraryAddMode::Copy).unwrap();
    assert_eq!(copied.source, None);
    let edit = SkillInput { id: Some(copied.id.clone()), agent_id: logica.id.clone(), name: "review".to_owned(), description: "新しい説明".to_owned(), body: String::new() };
    assert_eq!(app.services.skills.save(edit).unwrap().description, "新しい説明", "copy はふつうのスキル");
    assert_eq!(app.events.skills_changed.lock().len(), 3);
}

#[tokio::test]
async fn adding_reports_missing_folders_and_nonstandard_skills() {
    let app = TestApp::new();
    let logica = app.agent("expert", "ロジカ");
    app.library.put(&abs("skills"), &abs("skills/Draft"), "---\nname: Draft\ndescription: 下書き\n---\n", 0);
    let add = |path: &str| app.services.library.add(&logica.id, path, LibraryAddMode::Link);
    assert!(matches!(add(&abs("skills/nowhere")), Err(AppError::NotFound(_))));
    assert!(matches!(add(&abs("skills/Draft")), Err(AppError::Validation(_))));
    assert_eq!(add("skills/Draft").unwrap_err().to_command_error().field.as_deref(), Some("path"));
    let ghost = guild_domain::ids::AgentId::new("ghost");
    let missing_agent = app.services.library.add(&ghost, &abs("skills/Draft"), LibraryAddMode::Copy);
    assert_eq!(missing_agent, Err(AppError::NotFound("エージェント")));
    assert!(app.store.skills.lock().is_empty());
}

#[tokio::test]
async fn listing_rereads_linked_skills_and_shows_why_they_cannot_be_read() {
    let app = TestApp::new();
    let logica = app.agent("expert", "ロジカ");
    app.library.put(&abs("skills"), &abs("skills/unity"), &skill_md("unity", "Unity の手順"), 0);
    app.services.library.add(&logica.id, &abs("skills/unity"), LibraryAddMode::Link).unwrap();

    app.library.write(&abs("skills/unity"), &skill_md("unity", "書き換えた説明"));
    let listed = app.services.skills.list(&logica.id).unwrap();
    assert_eq!((listed[0].description.as_str(), listed[0].problem.as_deref()), ("書き換えた説明", None));

    app.library.remove(&abs("skills/unity"));
    let listed = app.services.skills.list(&logica.id).unwrap();
    assert_eq!(listed[0].description, "Unity の手順", "読めなければ DB の写し");
    assert_eq!(listed[0].problem.as_deref(), Some("フォルダが見つかりません"));
}

#[tokio::test]
async fn runs_reread_linked_skills_pass_their_folder_and_skip_unreadable_ones() {
    let app = TestApp::new();
    let haru = app.agent("worker", "ハル");
    let lobby = app.channel("ロビー", &[&haru]);
    app.library.put(&abs("skills"), &abs("skills/unity"), &skill_md("unity", "Unity の手順"), 0);
    app.library.put(&abs("skills"), &abs("skills/broken"), &skill_md("broken", "壊れる"), 0);
    for folder in ["skills/unity", "skills/broken"] {
        app.services.library.add(&haru.id, &abs(folder), LibraryAddMode::Link).unwrap();
    }
    let notes = SkillInput { id: None, agent_id: haru.id.clone(), name: "notes".to_owned(), description: "メモ".to_owned(), body: "# メモ\n".to_owned() };
    app.services.skills.save(notes).unwrap();
    app.library.write(&abs("skills/unity"), &skill_md("unity", "最新の説明"));
    app.library.write(&abs("skills/broken"), "frontmatter なし");
    app.runtime.script(haru.id.as_str(), reply("はい"));

    app.services.conversation.send_human_message(&lobby.id, "お願い", &[]).unwrap();
    app.settle().await;

    let request = &app.runtime.requests_for(haru.id.as_str())[0];
    let mut skills: Vec<(&str, &str, Option<PathBuf>)> =
        request.skills.iter().map(|s| (s.name.as_str(), s.description.as_str(), s.dir.clone())).collect();
    skills.sort();
    assert_eq!(skills, [("notes", "メモ", None), ("unity", "最新の説明", Some(PathBuf::from(abs("skills/unity"))))]);
}

#[tokio::test]
async fn reveal_opens_existing_folders_only() {
    let app = TestApp::new();
    app.library.put(&abs("skills"), &abs("skills/unity"), &skill_md("unity", "説明"), 0);
    app.services.library.reveal(&abs("skills/unity")).unwrap();
    assert_eq!(*app.folders.revealed.lock(), [PathBuf::from(abs("skills/unity"))]);
    assert_eq!(app.services.library.reveal(&abs("nowhere")), Err(AppError::NotFound("フォルダ")));
    assert_eq!(app.services.library.reveal("skills/unity"), Err(AppError::NotFound("フォルダ")));
}

#[tokio::test]
async fn changing_the_data_dir_keeps_the_library_dirs() {
    let app = TestApp::new();
    app.services.library.set_dirs(&[abs("skills")]).unwrap();
    app.services.storage.change_data_dir(&abs("guild2"), DataDirMode::Open).await.unwrap();
    let saved = app.settings.saved.lock().last().cloned().unwrap();
    assert_eq!(saved.skill_library_dirs, [PathBuf::from(abs("skills"))]);
    assert_eq!(saved.data_dir, Some(PathBuf::from(abs("guild2"))));
}
