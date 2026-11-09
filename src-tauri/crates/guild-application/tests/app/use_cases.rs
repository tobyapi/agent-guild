//! エージェント・スキル・チャンネル・プロフィール・メッセージ一覧のユースケース。

use std::sync::atomic::Ordering;

use guild_application::AppError;
use guild_domain::agent::PermissionKey;
use guild_domain::author::MemberId;
use guild_domain::backend::PermissionRule;
use guild_domain::profile::Profile;
use guild_domain::skill::SkillInput;

use crate::support::{input, TestApp};

fn skill(agent: &guild_domain::agent::Agent, name: &str) -> SkillInput {
    SkillInput {
        id: None,
        agent_id: agent.id.clone(),
        name: name.to_owned(),
        description: "レビューの手順".to_owned(),
        body: "# 手順\n".to_owned(),
    }
}

#[tokio::test]
async fn saving_checks_the_permission_rules_of_the_backend() {
    let app = TestApp::new();
    let rule = PermissionRule { when: PermissionKey::WriteFiles, requires: vec![PermissionKey::RunCommands] };
    app.runtime.backends.lock()[0].permission_rules = vec![rule];
    let rejected = app.services.agents.create(input("worker", "ソラ")).expect_err("runCommands がない");
    assert_eq!(rejected.to_command_error().field.as_deref(), Some("permissions"));
    let mut allowed = input("worker", "ソラ");
    allowed.permissions.run_commands = true;
    assert!(app.services.agents.create(allowed).is_ok());
    assert!(app.services.agents.create(input("expert", "ギア")).is_ok(), "書き込まないなら対象外");
}

#[tokio::test]
async fn agent_names_must_differ_from_other_agents_and_the_human() {
    let app = TestApp::new();
    app.agent("worker", "ハル");
    let duplicate = app.services.agents.create(input("expert", "ﾊﾙ"));
    assert!(matches!(duplicate, Err(AppError::Validation(_))), "NFKC で同じ名前");
    let human = app.services.agents.create(input("worker", "ユーザー"));
    assert!(matches!(human, Err(AppError::Validation(_))), "人間のプロフィール名と同じ");
    assert!(app.events.state_changes.load(Ordering::SeqCst) >= 1);
}

#[tokio::test]
async fn updating_keeps_the_identity() {
    let app = TestApp::new();
    let haru = app.agent("worker", "ハル");
    let updated = app.services.agents.update(&haru.id, input("worker", "ハルカ")).unwrap();
    assert_eq!((updated.id, updated.created_at, updated.name), (haru.id, haru.created_at, "ハルカ".to_owned()));
}

#[tokio::test]
async fn skills_are_validated_unique_and_announced() {
    let app = TestApp::new();
    let logica = app.agent("expert", "ロジカ");
    let invalid = app.services.skills.save(skill(&logica, "Review Checklist"));
    assert!(matches!(invalid, Err(AppError::Validation(_))), "名前は変換せずに拒否");
    let saved = app.services.skills.save(skill(&logica, "review-checklist")).unwrap();
    let again = app.services.skills.save(skill(&logica, "review-checklist"));
    assert!(matches!(again, Err(AppError::Conflict(_))));
    let mut edit = skill(&logica, "review-checklist");
    edit.id = Some(saved.id.clone());
    edit.body = "# 新しい手順\n".to_owned();
    assert_eq!(app.services.skills.save(edit).unwrap().body, "# 新しい手順\n");
    app.services.skills.delete(&saved.id).unwrap();
    assert!(app.services.skills.list(&logica.id).unwrap().is_empty());
    assert_eq!(app.events.skills_changed.lock().len(), 3);
}

#[tokio::test]
async fn channels_always_include_the_human_and_announce_new_members() {
    let app = TestApp::new();
    let haru = app.agent("worker", "ハル");
    let lobby = app.channel("#ロビー", &[]);
    assert_eq!((lobby.name.as_str(), lobby.member_ids.clone()), ("ロビー", vec![MemberId::Human]));
    let member = MemberId::Agent(haru.id.clone());
    app.services.channels.add_member(&lobby.id, &member).unwrap();
    app.services.channels.add_member(&lobby.id, &member).unwrap();
    assert_eq!(app.transcript(&lobby), vec!["システム: ハル がチャンネルに参加しました"]);
    let human = app.services.channels.remove_member(&lobby.id, &MemberId::Human).await;
    assert!(matches!(human, Err(AppError::Validation(_))));
}

#[tokio::test]
async fn the_profile_name_follows_the_name_rules() {
    let app = TestApp::new();
    app.agent("worker", "ハル");
    let taken = Profile { name: "ハル".to_owned(), ..Profile::default() };
    assert!(matches!(app.services.profile.update(taken), Err(AppError::Validation(_))));
    let renamed = Profile { name: " ランド ".to_owned(), ..Profile::default() };
    assert_eq!(app.services.profile.update(renamed).unwrap().name, "ランド");
}

#[tokio::test]
async fn messages_are_paged_by_seq() {
    let app = TestApp::new();
    let quiet = app.agent("worker", "ハル");
    let lobby = app.channel("ロビー", &[&quiet]);
    for index in 0..5 {
        app.services.conversation.send_human_message(&lobby.id, &format!("発言{index}"), &[]).unwrap();
    }
    let conversation = &app.services.conversation;
    let last_two = conversation.list_messages(&lobby.id, None, Some(2)).unwrap();
    assert_eq!(last_two.iter().map(|m| m.content.as_str()).collect::<Vec<_>>(), vec!["発言3", "発言4"]);
    let before = conversation.list_messages(&lobby.id, Some(last_two[0].seq), Some(2)).unwrap();
    assert_eq!(before.iter().map(|m| m.content.as_str()).collect::<Vec<_>>(), vec!["発言1", "発言2"]);
    assert!(matches!(conversation.send_human_message(&lobby.id, "  ", &[]), Err(AppError::Validation(_))));
}

#[tokio::test]
async fn refreshing_backends_probes_the_runner() {
    let app = TestApp::new();
    app.services.backends.refresh().await;
    assert_eq!(app.runtime.probes.load(Ordering::SeqCst), 1);
}
