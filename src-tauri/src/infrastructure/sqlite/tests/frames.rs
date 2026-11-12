//! アイコンの枠: 0003 の移行で列と表が足され、0002 までの DB のエージェントとプロフィールは枠なしで開ける。

use std::fs;
use std::sync::Arc;

use guild_application::ports::{AgentRepository, FrameRepository, ProfileRepository};
use guild_domain::frame::{CustomFrame, FrameArt};
use guild_domain::ids::AgentId;
use guild_domain::profile::Profile;
use rusqlite::{params, Connection};

use super::{memory, saved_agent, temp_dir};
use crate::infrastructure::sqlite::migrations::{self, APPLICATION_ID};
use crate::infrastructure::sqlite::{Database, SqliteAgentRepository, SqliteFrameRepository, SqliteProfileRepository};

/// 0002 までを当てた（配布済みの版が作った）データベースに、エージェントとプロフィールを1つずつ入れる
fn version_two_database(path: &std::path::Path) {
    let conn = Connection::open(path).unwrap();
    conn.pragma_update(None, "application_id", APPLICATION_ID).unwrap();
    conn.execute_batch("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)").unwrap();
    conn.execute_batch(include_str!("../migrations/0001_init.sql")).unwrap();
    conn.execute_batch(include_str!("../migrations/0002_channel_icon.sql")).unwrap();
    conn.pragma_update(None, "user_version", 2).unwrap();
    conn.execute("INSERT INTO meta (key, value) VALUES ('schema_fingerprint', ?1)", [migrations::fingerprint(2)])
        .unwrap();
    conn.execute("INSERT INTO profile (id, name, avatar, color) VALUES (1, 'ミナ', '🦊', '#f0ba5f')", []).unwrap();
    drop(conn);
    let db = Arc::new(Database::open_in_memory().unwrap());
    let agent = saved_agent(&db, "a1", "ハル", 1);
    let conn = Connection::open(path).unwrap();
    conn.execute(
        "INSERT INTO agents (id, name, name_key, avatar, color, tags, role, personality, tone, expertise, backend, \
         model, backend_options, permissions, unmentioned, consultable, can_delegate, autonomy_enabled, \
         autonomy_interval_min, created_at) VALUES (?1, ?2, ?3, '🌱', '#cb9d2a', '[]', '', '', '', '', 'claude', '', \
         '{}', ?4, 'answer', 0, 0, 0, 60, 1)",
        params![agent.id.as_str(), agent.name, "ハル", serde_json::to_string(&agent.permissions).unwrap()],
    )
    .unwrap();
}

#[test]
fn an_old_database_opens_with_no_frames() {
    let dir = temp_dir("frame-upgrade");
    let path = dir.join("guild.db");
    version_two_database(&path);
    let db = Arc::new(Database::open(&path).unwrap());
    let agents = SqliteAgentRepository::new(db.clone());
    let old = agents.get(&AgentId::new("a1")).unwrap().unwrap();
    assert_eq!((old.name.as_str(), old.frame.as_str()), ("ハル", ""));
    let profile = SqliteProfileRepository::new(db.clone());
    assert_eq!(profile.get().unwrap(), Profile { frame: String::new(), ..profile.get().unwrap() });
    assert_eq!(profile.get().unwrap().name, "ミナ");
    assert!(SqliteFrameRepository::new(db.clone()).list().unwrap().is_empty());
    agents.update(&guild_domain::agent::Agent { frame: "builtin:rose".to_owned(), ..old }).unwrap();
    drop((agents, profile, db));
    assert_eq!(migrations::applied_version(&Connection::open(&path).unwrap()).unwrap(), migrations::latest_version());
    let reopened = Arc::new(Database::open(&path).unwrap());
    assert_eq!(SqliteAgentRepository::new(reopened.clone()).list().unwrap()[0].frame, "builtin:rose");
    drop(reopened);
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn frames_and_choices_are_saved() {
    let db = memory();
    let frames = SqliteFrameRepository::new(db.clone());
    let svg = || FrameArt::Svg { svg: "<svg/>".to_owned() };
    let rose = CustomFrame { id: "custom:1".to_owned(), name: "薔薇".to_owned(), art: svg(), created_at: 2 };
    let chain = CustomFrame { id: "custom:2".to_owned(), name: "鎖".to_owned(), art: FrameArt::Png, created_at: 1 };
    frames.insert(&rose).unwrap();
    frames.insert(&chain).unwrap();
    assert_eq!(frames.list().unwrap(), vec![chain.clone(), rose.clone()], "作成順");
    assert_eq!(frames.get("custom:1").unwrap(), Some(rose));
    frames.delete("custom:1").unwrap();
    assert_eq!(frames.list().unwrap(), vec![chain]);

    let profile = SqliteProfileRepository::new(db.clone());
    profile.set(&Profile { frame: "custom:2".to_owned(), ..Profile::default() }).unwrap();
    assert_eq!(profile.get().unwrap().frame, "custom:2");
    let mut agent = saved_agent(&db, "a1", "ハル", 1);
    agent.frame = "builtin:gears".to_owned();
    SqliteAgentRepository::new(db.clone()).update(&agent).unwrap();
    assert_eq!(SqliteAgentRepository::new(db).list().unwrap()[0].frame, "builtin:gears");
}
