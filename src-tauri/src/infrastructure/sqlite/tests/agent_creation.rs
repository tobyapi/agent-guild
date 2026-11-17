use super::{input, memory};
use crate::infrastructure::sqlite::{
    Database, SqliteAgentRepository, SqliteChannelRepository, SqliteMessageRepository,
};
use guild_application::ports::{AgentRepository, ChannelRepository, MessageRepository};
use guild_domain::{
    agent::Agent,
    author::Author,
    ids::{AgentId, MessageId},
    skill_usage::SkillUsage,
};
use std::sync::Arc;

fn fixture(db: &Arc<Database>) -> (SqliteAgentRepository, Agent, Agent, MessageId) {
    let repo = SqliteAgentRepository::new(db.clone());
    let actor = Agent::new(AgentId::new("actor"), input("manager", "Manager"), 1);
    let target = Agent::new(AgentId::new("new"), input("worker", "New"), 2);
    repo.insert(&actor).unwrap();
    let mut channel = super::channels_messages::lobby();
    channel.member_ids.clear();
    SqliteChannelRepository::new(db.clone()).insert(&channel).unwrap();
    let mut message = super::channels_messages::new_message("source", "Requested.");
    message.author_id = Author::Agent(actor.id.clone());
    message.skill_usage = Some(SkillUsage { run_id: Some("run-1".into()), ..Default::default() });
    let id = message.id.clone();
    SqliteMessageRepository::new(db.clone()).insert(message).unwrap();
    (repo, actor, target, id)
}

#[test]
fn creation_sqlite_is_atomic_and_persists_trusted_provenance() {
    let db = memory();
    let (repo, actor, target, message) = fixture(&db);
    assert_eq!(register(&repo, &actor.id, "run-1", &message, "task-1", &target).unwrap(), target);
    assert_eq!(repo.get(&target.id).unwrap(), Some(target.clone()));
    let receipt: (String, String, String, String) = db
        .with(|conn| {
            conn.query_row(
                "SELECT created_by, request_id, run_id, message_id FROM agent_creation_receipts",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
        })
        .unwrap();
    assert_eq!(receipt, ("actor".into(), "task-1".into(), "run-1".into(), "source".into()));
    let mut other = target.clone();
    other.id = AgentId::new("other");
    other.name = "Other".into();
    assert_eq!(register(&repo, &actor.id, "run-1", &message, "different-key", &other).unwrap(), target);
    assert_eq!(repo.list().unwrap().len(), 2);
}

#[test]
fn creation_sqlite_rechecks_stored_role_source_and_target() {
    let db = memory();
    let (repo, mut actor, target, message) = fixture(&db);
    let original = actor.clone();
    let worker_tags = input("worker", "Unused").tags;
    for tags in
        [vec![], vec!["unknown".into()], worker_tags.clone(), vec![worker_tags[0].clone(), actor.tags[0].clone()]]
    {
        actor.tags = tags;
        actor.role = "manager".into();
        actor.can_delegate = true;
        repo.update(&actor).unwrap();
        assert!(register(&repo, &actor.id, "run-1", &message, "key", &target).is_err());
    }
    repo.update(&original).unwrap();
    assert!(register(&repo, &AgentId::new("unknown"), "run-1", &message, "key", &target).is_err());
    assert!(register(&repo, &actor.id, "forged-run", &message, "key", &target).is_err());
    assert!(register(&repo, &actor.id, "run-1", &MessageId::new("missing"), "key", &target).is_err());
    let manager_target = Agent::new(AgentId::new("bad-target"), input("manager", "Escalated"), 3);
    assert!(register(&repo, &actor.id, "run-1", &message, "key", &manager_target).is_err());
    repo.mark_deleted(&actor.id, 4).unwrap();
    assert!(register(&repo, &actor.id, "run-1", &message, "key", &target).is_err());
    assert_eq!(repo.list().unwrap().len(), 1);
}

#[test]
fn creation_sqlite_receipt_failure_rolls_back_registration_and_allows_retry() {
    let db = memory();
    let (repo, actor, target, message) = fixture(&db);
    db.with(|conn| conn.execute_batch("CREATE TRIGGER fail_receipt BEFORE INSERT ON agent_creation_receipts BEGIN SELECT RAISE(ABORT, 'injected receipt failure'); END;")).unwrap();
    assert!(register(&repo, &actor.id, "run-1", &message, "key", &target).is_err());
    assert!(repo.get(&target.id).unwrap().is_none());
    let count: i64 =
        db.with(|conn| conn.query_row("SELECT COUNT(*) FROM agent_creation_receipts", [], |row| row.get(0))).unwrap();
    assert_eq!(count, 0);
    db.with(|conn| conn.execute_batch("DROP TRIGGER fail_receipt")).unwrap();
    assert!(register(&repo, &actor.id, "run-1", &message, "key", &target).is_ok());
}

#[test]
fn creation_sqlite_concurrent_reprocessing_creates_one_agent() {
    let db = memory();
    let (_, actor, target, message) = fixture(&db);
    let handles: Vec<_> = (0..12)
        .map(|index| {
            let db = db.clone();
            let actor = actor.clone();
            let mut target = target.clone();
            let message = message.clone();
            target.id = AgentId::new(format!("candidate-{index}"));
            target.name = format!("Candidate{index}");
            std::thread::spawn(move || {
                register(&SqliteAgentRepository::new(db), &actor.id, "run-1", &message, "key", &target).unwrap().id
            })
        })
        .collect();
    let ids: Vec<_> = handles.into_iter().map(|h| h.join().unwrap()).collect();
    assert!(ids.iter().all(|id| id == &ids[0]));
    assert_eq!(SqliteAgentRepository::new(db).list().unwrap().len(), 2);
}

#[test]
fn creation_sqlite_receipt_survives_reopen_and_new_run_retry() {
    let dir = super::temp_dir("creation-reopen");
    let path = dir.join("guild.db");
    let db = Arc::new(Database::open(&path).unwrap());
    let (repo, actor, target, message) = fixture(&db);
    register(&repo, &actor.id, "run-1", &message, "key", &target).unwrap();
    drop(repo);
    drop(db);
    let db = Arc::new(Database::open(&path).unwrap());
    let mut msg = super::channels_messages::new_message("retry-source", "Retry.");
    msg.author_id = Author::Agent(actor.id.clone());
    msg.skill_usage = Some(SkillUsage { run_id: Some("new-run".into()), ..Default::default() });
    let message = SqliteMessageRepository::new(db.clone()).insert(msg).unwrap();
    let repo = SqliteAgentRepository::new(db.clone());
    let mut other = target.clone();
    other.id = AgentId::new("other");
    other.name = "Other".into();
    assert_eq!(register(&repo, &actor.id, "new-run", &message.id, "key", &other).unwrap(), target);
    assert_eq!(repo.list().unwrap().len(), 2);
    drop(repo);
    drop(db);
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn creation_migration_from_version_seven_preserves_agents_and_conversation() {
    let dir = super::temp_dir("creation-migration");
    let path = dir.join("guild.db");
    let db = Arc::new(Database::open(&path).unwrap());
    let (repo, _, _, message) = fixture(&db);
    db.with(|conn| conn.execute_batch("DROP TABLE agent_creation_receipts; DROP TABLE agent_creation_audit; PRAGMA user_version = 7; UPDATE meta SET value = '14512365f8e91d16' WHERE key = 'schema_fingerprint';")).unwrap();
    drop(repo);
    drop(db);
    let db = Arc::new(Database::open(&path).unwrap());
    assert_eq!(SqliteAgentRepository::new(db.clone()).list().unwrap().len(), 1);
    let stored = SqliteMessageRepository::new(db.clone()).get(&message).unwrap().unwrap();
    assert_eq!(stored.content, "Requested.");
    assert!(db.with(|conn| conn.execute("INSERT INTO agent_creation_audit (principal_id,message_id,reason,claims,created_at) VALUES ('actor','source','invalid_request','actorId=forged',1)", [])).is_ok());
    drop(db);
    std::fs::remove_dir_all(dir).unwrap();
}

fn register(
    repo: &SqliteAgentRepository,
    actor: &AgentId,
    run: &str,
    message: &MessageId,
    key: &str,
    agent: &Agent,
) -> guild_application::AppResult<Agent> {
    repo.insert_from_agent(
        actor,
        run,
        message,
        key,
        &guild_application::ports::AgentRegistration { agent, skills: &[], channels: &[] },
    )
}

#[test]
fn creation_sqlite_membership_failure_leaves_no_agent_skill_or_receipt() {
    let db = memory();
    let (repo, actor, target, message) = fixture(&db);
    let channels = [guild_domain::ids::ChannelId::new("missing-channel")];
    let skills = [guild_domain::skill::Skill {
        id: guild_domain::ids::SkillId::new("default-skill"),
        agent_id: target.id.clone(),
        name: "clean-code".into(),
        description: "Default".into(),
        body: "Safe body".into(),
        source: None,
        problem: None,
        updated_at: 2,
    }];
    let registration =
        guild_application::ports::AgentRegistration { agent: &target, skills: &skills, channels: &channels };
    assert!(repo.insert_from_agent(&actor.id, "run-1", &message, "key", &registration).is_err());
    assert!(repo.get(&target.id).unwrap().is_none());
    let count: i64 =
        db.with(|conn| conn.query_row("SELECT COUNT(*) FROM agent_creation_receipts", [], |row| row.get(0))).unwrap();
    assert_eq!(count, 0);
    let skills: i64 = db.with(|conn| conn.query_row("SELECT COUNT(*) FROM skills", [], |row| row.get(0))).unwrap();
    assert_eq!(skills, 0);
}
