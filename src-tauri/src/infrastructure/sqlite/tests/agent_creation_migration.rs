use super::super::{migrations, Database, SqliteAgentRepository, SqliteMessageRepository};
use super::agent_creation::{fixture, register};
use guild_application::ports::{AgentRepository, MessageRepository};
use std::sync::Arc;

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
#[test]
fn creation_migration_from_version_eight_preserves_receipts_and_conversation() {
    let dir = super::temp_dir("creation-migration-eight");
    let path = dir.join("guild.db");
    let db = Arc::new(Database::open(&path).unwrap());
    let (repo, actor, target, message) = fixture(&db);
    register(&repo, &actor.id, "run-1", &message, "key", &target).unwrap();
    db.with(|conn| {
        conn.execute_batch("ALTER TABLE agent_creation_receipts RENAME TO preserved_receipts;")?;
        let sql = include_str!("../migrations/0008_agent_creation.sql").split("-- Rejections").next().unwrap();
        conn.execute_batch(sql)?;
        conn.execute_batch("INSERT INTO agent_creation_receipts SELECT * FROM preserved_receipts; DROP TABLE preserved_receipts; PRAGMA user_version = 8;")?;
        conn.execute("UPDATE meta SET value = ?1 WHERE key = 'schema_fingerprint'", [migrations::fingerprint(8)])?;
        Ok(())
    }).unwrap();
    drop(repo);
    drop(db);
    let db = Arc::new(Database::open(&path).unwrap());
    let repo = SqliteAgentRepository::new(db.clone());
    assert_eq!(register(&repo, &actor.id, "run-1", &message, "key", &target).unwrap(), target);
    assert_eq!(repo.list().unwrap().len(), 2);
    assert_eq!(SqliteMessageRepository::new(db.clone()).get(&message).unwrap().unwrap().content, "Requested.");
    assert_eq!(
        db.with(|conn| conn.query_row("SELECT COUNT(*) FROM pragma_foreign_key_check", [], |row| row.get::<_, i64>(0)))
            .unwrap(),
        0
    );
    drop(repo);
    drop(db);
    std::fs::remove_dir_all(dir).unwrap();
}
