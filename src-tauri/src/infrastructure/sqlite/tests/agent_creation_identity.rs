use super::agent_creation::{fixture, register};
use super::{input, memory};
use crate::infrastructure::sqlite::SqliteMessageRepository;
use guild_application::ports::{AgentRepository, MessageRepository};
use guild_domain::{agent::Agent, author::Author, ids::AgentId, skill_usage::SkillUsage};

#[test]
fn creation_sqlite_same_request_id_is_independent_for_different_actors() {
    let db = memory();
    let (repo, actor, target, message) = fixture(&db);
    register(&repo, &actor.id, "run-1", &message, "shared-key", &target).unwrap();
    let other_actor = Agent::new(AgentId::new("other-manager"), input("manager", "Other manager"), 3);
    repo.insert(&other_actor).unwrap();
    let mut source = super::channels_messages::new_message("other-source", "Another manager request.");
    source.author_id = Author::Agent(other_actor.id.clone());
    source.skill_usage = Some(SkillUsage { run_id: Some("run-1".into()), ..Default::default() });
    let source = SqliteMessageRepository::new(db).insert(source).unwrap();
    let other_target = Agent::new(AgentId::new("other-worker"), input("worker", "Other worker"), 4);
    assert_eq!(
        register(&repo, &other_actor.id, "run-1", &source.id, "shared-key", &other_target).unwrap(),
        other_target
    );
    assert_eq!(register(&repo, &actor.id, "run-1", &message, "shared-key", &target).unwrap(), target);
    assert_eq!(
        register(&repo, &other_actor.id, "run-1", &source.id, "shared-key", &other_target).unwrap(),
        other_target
    );
    assert_eq!(repo.list().unwrap().len(), 4);
}
