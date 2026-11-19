mod adjustments;
mod fixture;
mod records;
mod wal;
use super::*;
use crate::infrastructure::sqlite::Database;
use fixture::{old, populate, Fixture};
use rusqlite::Connection;
use std::{fs, path::PathBuf, process::Command};

#[test]
fn legacy_classification_is_read_only() {
    for version in 1..=7 {
        let fixture = Fixture::new();
        drop(old(&fixture.db(), version));
        let original = fs::read(fixture.db()).unwrap();
        let result = inspect(&fixture.db());
        if version < 7 {
            assert!(matches!(result, Err(OpenError::Needs028)), "{version}: {result:?}");
        } else {
            result.unwrap();
        }
        assert_eq!(original, fs::read(fixture.db()).unwrap());
        assert!(!fixture.0.join("backups").exists());
    }
}

#[test]
fn upgraded_and_fresh_028_match_the_frozen_identity() {
    for steps in [&[1, 4, 5, 7][..], &[7][..]] {
        let fixture = Fixture::new();
        for &version in steps {
            drop(old(&fixture.db(), version));
        }
        let db = source::read_only(&fixture.db()).unwrap();
        assert!(matches!(classify(&db), Ok(Generation::Legacy)));
        assert_eq!(schema::structure(&db).unwrap(), 0x1098ca4437397d6b);
        let fp: String =
            db.query_row("SELECT value FROM meta WHERE key='schema_fingerprint'", [], |r| r.get(0)).unwrap();
        assert_eq!(fp, "14512365f8e91d16");
    }
}

#[test]
fn legacy_rejects_unknown_schema_or_fingerprint_without_writes() {
    for sql in [
        "CREATE INDEX unexpected ON agents(color)",
        "ALTER TABLE agents RENAME COLUMN tone TO old_tone",
        "UPDATE meta SET value='unknown'",
        "DROP TABLE meta",
    ] {
        let f = Fixture::new();
        old(&f.db(), 7).execute_batch(sql).unwrap();
        let before = fs::read(f.db()).unwrap();
        assert!(matches!(Database::open(&f.db()), Err(OpenError::Corrupt(_))));
        assert_eq!(fs::read(f.db()).unwrap(), before);
        assert!(!f.0.join("backups").exists());
    }
}

#[test]
fn canonical_workspace_examples_keep_the_runner_boundary() {
    let cases: Vec<serde_json::Value> = serde_json::from_str(include_str!("channel-workspaces.json")).unwrap();
    for case in cases {
        let f = Fixture::new();
        let db = old(&f.db(), 7);
        populate(&db);
        db.execute("UPDATE channels SET workspace_json=?", [case["saved"].to_string()]).unwrap();
        drop(db);
        prepare(&f.db()).unwrap();
        let db = source::read_only(&f.db()).unwrap();
        let (seq, guard): (i64, bool) = db
            .query_row("SELECT history_after_seq,guard_old_roots FROM channels", [], |r| Ok((r.get(0)?, r.get(1)?)))
            .unwrap();
        assert_eq!(Some(seq), case["loaded"]["afterSeq"].as_i64());
        assert_eq!(guard, case["loaded"]["revision"].as_u64().unwrap() > 0);
    }
}

#[test]
fn conversion_restarts_at_every_durability_boundary() {
    for point in ["before-backup", "after-backup", "before-commit", "after-commit"] {
        let f = Fixture::new();
        populate(&old(&f.db(), 7));
        let exit = Command::new(std::env::current_exe().unwrap())
            .args(["--exact", "infrastructure::sqlite::convert028::tests::open_disposable_copy"])
            .env("GUILD_DATA_DIR", &f.0)
            .env("GUILD_CONVERSION_TEST_CHILD", "1")
            .env("GUILD_DB_TEST_FAULT", point)
            .status()
            .unwrap();
        assert_eq!(exit.code(), Some(87), "{point}");
        let image = source::Snapshot::open(&f.db()).unwrap();
        let version: i64 = image.db.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap();
        assert_eq!(version, if point == "after-commit" { 8 } else { 7 });
        drop(image);
        let folders =
            || fs::read_dir(f.0.join("backups/pre-1.0.0")).unwrap().map(|e| e.unwrap().path()).collect::<Vec<_>>();
        let copies = folders();
        assert_eq!(copies.len(), 1);
        assert_eq!(copies[0].join("guild.db").exists(), point != "before-backup");
        prepare(&f.db()).unwrap();
        inspect(&f.db()).unwrap();
        assert_eq!(folders().len(), 1);
        assert!(!f.0.join("backups/pre-1.0.0/.pending").exists());
        verify(&source::read_only(&f.db()).unwrap());
    }
}

#[test]
fn open_disposable_copy() {
    if std::env::var("GUILD_CONVERSION_TEST_CHILD").as_deref() != Ok("1") {
        return;
    }
    let root = PathBuf::from(std::env::var_os("GUILD_DATA_DIR").unwrap());
    assert!(root.file_name().unwrap().to_string_lossy().starts_with("guild-conversion-"));
    let _ = env_logger::Builder::new().filter_level(log::LevelFilter::Warn).try_init();
    let _lock = crate::infrastructure::data_dir::acquire_lock(&root, Duration::ZERO).unwrap();
    Database::open(&root.join("guild.db")).unwrap();
}

fn verify(db: &Connection) {
    for sql in [
        "SELECT count(*)=2 FROM messages",
        "SELECT seeded=1 FROM db_state",
        "SELECT seq=101 FROM sqlite_sequence WHERE name='messages'",
        "SELECT group_concat(actor_id)= 'me,a' FROM (SELECT actor_id FROM channel_members ORDER BY position)",
        "SELECT group_concat(label)='作業者,z' FROM (SELECT label FROM agent_tags ORDER BY position)",
        "SELECT voice_mode='off' AND voice_intensity='strong' FROM agents",
        "SELECT skill_usage_json IS NULL AND content='one' FROM messages WHERE seq=14",
        "SELECT json_type(skill_usage_json,'$.declared')='array' AND reply_to_id='m' FROM messages WHERE seq=15",
        "SELECT source_message_id='r' AND status='done' FROM delegations",
        "SELECT actor_id='a' FROM message_mentions",
        "SELECT outcome='attempted' FROM notification_receipts WHERE message_id='r'",
        "SELECT channel_id='c' AND agent_id='a' AND root_id='m' AND depth=1 FROM interrupted_jobs",
        "SELECT name='Guild' AND crest_color='jade' FROM guild_profile",
    ] {
        assert!(db.query_row(sql, [], |r| r.get::<_, bool>(0)).unwrap(), "{sql}");
    }
}

#[test]
fn bad_values_roll_back_to_seven() {
    for sql in [
        "UPDATE messages SET mentions='{}'",
        "UPDATE messages SET delegation_id=NULL",
        "UPDATE channels SET workspace_json='{}'",
        "INSERT INTO channel_members VALUES('c','system')",
        "UPDATE messages SET skill_usage='42'",
        "UPDATE messages SET root_id='missing'",
        "UPDATE delegations SET status='unknown'",
    ] {
        let f = Fixture::new();
        let db = old(&f.db(), 7);
        populate(&db);
        db.execute_batch(sql).unwrap();
        drop(db);
        let before = fs::read(f.db()).unwrap();
        assert!(matches!(inspect(&f.db()), Err(OpenError::Conversion { backup: None, .. })), "{sql}");
        for _ in 0..2 {
            assert!(matches!(prepare(&f.db()), Err(OpenError::Conversion { backup: None, .. })), "{sql}");
            assert!(!f.0.join("backups").exists(), "{sql}");
        }
        assert_eq!(before, fs::read(f.db()).unwrap(), "{sql}");
        let db = source::read_only(&f.db()).unwrap();
        assert!(matches!(classify(&db).unwrap(), Generation::Legacy));
        assert_eq!(db.query_row("SELECT count(*) FROM messages", [], |r| r.get::<_, i64>(0)).unwrap(), 2);
    }
}
