use super::{
    fixture::{old, populate, Fixture},
    inspect, prepare, source, verify, OpenError,
};
use std::fs;

fn source_bytes(f: &Fixture) -> Vec<Option<Vec<u8>>> {
    ["guild.db", "guild.db-wal", "guild.db-shm", "guild-data.json"]
        .iter()
        .map(|name| {
            let path = f.0.join(name);
            path.try_exists().unwrap().then(|| fs::read(path).unwrap())
        })
        .collect()
}

#[test]
fn classification_preserves_wal_shm_and_marker() {
    for version in [5, 7] {
        let live = Fixture::new();
        let db = old(&live.db(), version);
        db.execute_batch("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;").unwrap();
        db.execute("INSERT INTO meta VALUES ('seeded','1')", []).unwrap();
        let before = source_bytes(&live);
        assert!(before[1].as_ref().is_some_and(|wal| wal.len() > 32));
        let result = inspect(&live.db());
        if version == 5 {
            assert!(matches!(result, Err(OpenError::Needs028)));
            assert!(matches!(prepare(&live.db()), Err(OpenError::Needs028)));
        } else {
            result.unwrap();
        }
        assert_eq!(before, source_bytes(&live));
        assert!(!live.0.join("backups").exists());
    }
}

#[test]
fn includes_committed_wal_records_in_the_backup_and_the_converted_database() {
    let live = Fixture::new();
    let db = old(&live.db(), 7);
    db.execute_batch("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;").unwrap();
    populate(&db);
    let copy = Fixture::new();
    for file in ["guild.db", "guild.db-wal"] {
        fs::copy(live.0.join(file), copy.0.join(file)).unwrap();
    }
    // The main file alone is the last checkpoint; both messages exist only in the WAL.
    assert_eq!(
        source::read_only(&copy.db())
            .unwrap()
            .query_row("SELECT count(*) FROM messages", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        0
    );
    prepare(&copy.db()).unwrap();
    verify(&source::read_only(&copy.db()).unwrap());
    let folder = fs::read_dir(copy.0.join("backups/pre-1.0.0")).unwrap().next().unwrap().unwrap().path();
    let backup = source::read_only(&folder.join("guild.db")).unwrap();
    assert_eq!(backup.query_row("SELECT count(*) FROM messages", [], |r| r.get::<_, i64>(0)).unwrap(), 2);
    assert_eq!(backup.query_row("PRAGMA user_version", [], |r| r.get::<_, i64>(0)).unwrap(), 7);
}

#[test]
fn unexpected_sidecars_and_incomplete_backups_stop_before_conversion() {
    let f = Fixture::new();
    populate(&old(&f.db(), 7));
    fs::write(f.0.join("guild.db-shm"), b"orphan").unwrap();
    let original = source_bytes(&f);
    assert!(prepare(&f.db()).is_err());
    assert_eq!(source_bytes(&f), original);
    fs::remove_file(f.0.join("guild.db-shm")).unwrap();
    fs::write(f.0.join("backups"), b"cannot create backup here").unwrap();
    let original = source_bytes(&f);
    assert!(prepare(&f.db()).is_err());
    assert_eq!(source_bytes(&f), original);
}
