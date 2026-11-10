use std::fs;
use std::sync::Arc;

use guild_application::ports::SkillRepository;
use guild_domain::ids::{AgentId, SkillId};
use guild_domain::skill::SkillSource;
use rusqlite::Connection;

use super::temp_dir;
use crate::infrastructure::sqlite::migrations::APPLICATION_ID;
use crate::infrastructure::sqlite::{Database, SqliteSkillRepository};

#[test]
fn upgrading_turns_linked_paths_into_skill_sources() {
    let directory = temp_dir("skill-source-v1");
    let path = directory.join("guild.db");
    let old = Connection::open(&path).unwrap();
    old.execute_batch(include_str!("../migrations/0001_init.sql")).unwrap();
    old.pragma_update(None, "application_id", APPLICATION_ID).unwrap();
    old.pragma_update(None, "user_version", 1).unwrap();
    old.execute_batch(
        "PRAGMA foreign_keys = OFF;
         CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
         INSERT INTO meta VALUES ('schema_fingerprint', '71a7e472e051edb6');
         INSERT INTO skills VALUES ('s1', 'a1', 'notes', 'メモ', '本文', NULL, 1),
             ('s2', 'a1', 'unity', 'Unity', '手順', 'D:/skills/unity', 2);",
    )
    .unwrap();
    drop(old);

    let db = Arc::new(Database::open(&path).unwrap());
    let skills = SqliteSkillRepository::new(db.clone());
    assert_eq!(skills.get(&SkillId::new("s1")).unwrap().unwrap().source, None);
    let linked = skills.get(&SkillId::new("s2")).unwrap().unwrap();
    assert_eq!(linked.source, Some(SkillSource::Linked { path: "D:/skills/unity".to_owned() }));
    assert_eq!(skills.list_for_agent(&AgentId::new("a1")).unwrap().len(), 2);
    drop(skills);
    drop(db);
    fs::remove_dir_all(directory).unwrap();
}
