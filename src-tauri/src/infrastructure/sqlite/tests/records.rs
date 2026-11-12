//! エージェント・スキル・プロフィール・meta の往復。

use guild_application::ports::{AgentRepository, MetaRepository, ProfileRepository, SkillRepository};
use guild_application::AppError;
use guild_domain::agent::{Agent, UnmentionedPolicy};
use guild_domain::ids::{AgentId, ChannelId, SkillId};
use guild_domain::profile::Profile;
use guild_domain::skill::{Skill, SkillSource};
use serde_json::json;

use super::{input, memory, saved_agent};
use crate::infrastructure::sqlite::{
    SqliteAgentRepository, SqliteMetaRepository, SqliteProfileRepository, SqliteSkillRepository,
};

#[test]
fn agents_round_trip_with_json_columns() {
    let db = memory();
    let repository = SqliteAgentRepository::new(db.clone());
    let mut sora = Agent::new(AgentId::new("a2"), input("worker", "ソラ"), 20);
    sora.backend_options = json!({ "effort": "high", "maxTurns": 30 }).as_object().cloned().unwrap();
    sora.permissions.run_commands = true;
    sora.tags = vec!["作業者".to_owned(), "実装".to_owned()];
    sora.unmentioned = UnmentionedPolicy::Ignore;
    sora.consultable = true;
    sora.autonomy_channel_id = Some(ChannelId::new("c1"));
    repository.insert(&sora).unwrap();
    let haru = saved_agent(&db, "a1", "ハル", 10);

    assert_eq!(repository.list().unwrap(), vec![haru, sora.clone()], "作成順");
    sora.last_autonomous_at = Some(99);
    sora.name = "ソラ改".to_owned();
    sora.unmentioned = UnmentionedPolicy::Lead;
    sora.can_delegate = true;
    repository.update(&sora).unwrap();
    assert_eq!(repository.get(&sora.id).unwrap(), Some(sora.clone()));
    assert_eq!(repository.get(&AgentId::new("none")).unwrap(), None);
}

#[test]
fn active_agent_names_are_unique_after_normalization() {
    let db = memory();
    let repository = SqliteAgentRepository::new(db.clone());
    saved_agent(&db, "a1", "Haru", 1);
    let twin = Agent::new(AgentId::new("a2"), input("worker", "ｈａｒｕ"), 2);
    assert!(matches!(repository.insert(&twin), Err(AppError::Validation(_))));
    repository.mark_deleted(&AgentId::new("a1"), 5).unwrap();
    repository.insert(&twin).unwrap();
    let deleted = repository.get(&AgentId::new("a1")).unwrap().unwrap();
    assert_eq!(deleted.deleted_at, Some(5), "論理削除は一覧に残る");
    assert_eq!(repository.list().unwrap().len(), 2);
}

#[test]
fn skills_are_unique_per_agent_and_follow_their_agent() {
    let db = memory();
    saved_agent(&db, "a1", "ロジカ", 1);
    let repository = SqliteSkillRepository::new(db.clone());
    let skill = |id: &str, name: &str| Skill {
        id: SkillId::new(id),
        agent_id: AgentId::new("a1"),
        name: name.to_owned(),
        description: "説明".to_owned(),
        body: "# 手順\n".to_owned(),
        source: None,
        problem: None,
        updated_at: 1,
    };
    repository.upsert(&skill("s2", "review")).unwrap();
    repository.upsert(&skill("s1", "checklist")).unwrap();
    let names: Vec<String> =
        repository.list_for_agent(&AgentId::new("a1")).unwrap().into_iter().map(|s| s.name).collect();
    assert_eq!(names, vec!["checklist", "review"], "名前順");
    assert!(matches!(repository.upsert(&skill("s3", "review")), Err(AppError::Conflict(_))));
    let mut edited = skill("s1", "checklist-v2");
    edited.updated_at = 2;
    repository.upsert(&edited).unwrap();
    assert_eq!(repository.get(&SkillId::new("s1")).unwrap(), Some(edited));
    let linked =
        Skill { source: Some(SkillSource::Linked { path: "D:/skills/unity".to_owned() }), ..skill("s4", "unity") };
    repository.upsert(&linked).unwrap();
    assert_eq!(repository.get(&SkillId::new("s4")).unwrap(), Some(linked), "参照先は source に入る");
    let builtin = Skill {
        source: Some(SkillSource::Builtin { name: "introspection".to_owned() }),
        ..skill("s5", "introspection")
    };
    repository.upsert(&builtin).unwrap();
    assert_eq!(repository.get(&SkillId::new("s5")).unwrap(), Some(builtin), "内蔵スキルの参照も source に入る");
    repository.delete(&SkillId::new("s1")).unwrap();
    repository.delete_for_agent(&AgentId::new("a1")).unwrap();
    assert!(repository.list_for_agent(&AgentId::new("a1")).unwrap().is_empty());
}

#[test]
fn the_profile_defaults_until_saved_and_meta_stores_records() {
    let db = memory();
    let profile = SqliteProfileRepository::new(db.clone());
    assert_eq!(profile.get().unwrap(), Profile::default());
    let mine = Profile {
        name: "ランド".to_owned(),
        avatar: "🦊".to_owned(),
        color: "#f0ba5f".to_owned(),
        frame: String::new(),
    };
    profile.set(&mine).unwrap();
    assert_eq!(profile.get().unwrap(), mine);

    let meta = SqliteMetaRepository::new(db);
    assert_eq!(meta.get("seeded").unwrap(), None);
    meta.set("seeded", "1").unwrap();
    meta.set("seeded", "2").unwrap();
    assert_eq!(meta.get("seeded").unwrap(), Some("2".to_owned()));
}

#[test]
fn ollama_tool_opt_in_round_trips_without_enabling_existing_agents() {
    let db = memory();
    let repository = SqliteAgentRepository::new(db);
    let mut agent = Agent::new(AgentId::new("ollama"), input("worker", "ローカル"), 1);
    agent.backend = "ollama".to_owned();
    repository.insert(&agent).unwrap();
    assert!(!repository.get(&agent.id).unwrap().unwrap().backend_options.contains_key("enableTools"));
    for enabled in [false, true, false] {
        agent.backend_options.insert("enableTools".to_owned(), json!(enabled));
        repository.update(&agent).unwrap();
        assert_eq!(
            repository.get(&agent.id).unwrap().unwrap().backend_options.get("enableTools"),
            Some(&json!(enabled))
        );
    }
}
