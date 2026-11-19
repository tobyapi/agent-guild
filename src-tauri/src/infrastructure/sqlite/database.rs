//! SQLite の接続。1接続を Mutex で守り（WAL）、各リポジトリはこの Database を共有する。
//! 開くときに自分の DB か（application_id）・新しすぎないか（user_version）・壊れていないかを確かめる。

use std::path::Path;

use parking_lot::Mutex;
use rusqlite::{Connection, OpenFlags};

use super::schema;

mod messages;

/// データベースの操作の失敗
#[derive(Debug, thiserror::Error)]
pub enum DbError {
    #[error("{}", messages::sqlite_failed(.0))]
    Sqlite(#[from] rusqlite::Error),
    #[error("{}", messages::io_failed(.0))]
    Io(#[from] std::io::Error),
}

/// 開けなかった理由（起動の復旧モードの理由に対応する）
#[derive(Debug, thiserror::Error)]
pub enum OpenError {
    #[error("{}", messages::foreign())]
    Foreign,
    #[error("{}", messages::newer(.0))]
    Newer(usize),
    #[error("{}", messages::corrupt(.0))]
    Corrupt(String),
}

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    /// Boot holds the data-directory lock before opening a database.
    pub fn open(path: &Path) -> Result<Self, OpenError> {
        let existing = path.try_exists().map_err(corrupt)?;
        if existing {
            inspect_database(path)?;
        }
        let conn = connect(path).map_err(corrupt)?;
        if !existing {
            initialize(&conn).map_err(corrupt)?;
        }
        Ok(Self { conn: Mutex::new(conn) })
    }
    pub fn open_in_memory() -> Result<Self, OpenError> {
        let conn = Connection::open_in_memory().map_err(corrupt)?;
        conn.pragma_update(None, "foreign_keys", true).map_err(corrupt)?;
        initialize(&conn).map_err(corrupt)?;
        Ok(Self { conn: Mutex::new(conn) })
    }

    /// 一貫したコピーを path に作る（VACUUM INTO。path にファイルがあってはいけない）
    pub fn export_to(&self, path: &Path) -> Result<(), DbError> {
        let target = path.to_string_lossy().into_owned();
        self.with(|conn| conn.execute("VACUUM INTO ?1", [target]).map(|_| ()))
    }

    /// 接続を借りて処理する（ロックはこの呼び出しの間だけ持つ）
    pub(super) fn with<T>(&self, work: impl FnOnce(&Connection) -> rusqlite::Result<T>) -> Result<T, DbError> {
        let conn = self.conn.lock();
        work(&conn).map_err(DbError::from)
    }
}

/// 移動先の候補にある guild.db を、書き込まずに調べる（この版で開けるなら Ok）
pub fn inspect_database(path: &Path) -> Result<(), OpenError> {
    let flags = OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX;
    let conn = Connection::open_with_flags(path, flags).map_err(corrupt)?;
    if conn.query_row("PRAGMA application_id", [], |r| r.get::<_, i32>(0)).map_err(corrupt)? != schema::APPLICATION_ID {
        return Err(OpenError::Foreign);
    }
    let version = conn.query_row("PRAGMA user_version", [], |r| r.get::<_, i64>(0)).map_err(corrupt)?;
    if version > schema::VERSION {
        return Err(OpenError::Newer(version as usize));
    }
    if version != schema::VERSION || schema::structure(&conn).map_err(corrupt)? != schema::STRUCTURE {
        return Err(OpenError::Corrupt(messages::fingerprint_mismatch()));
    }
    Ok(())
}

fn initialize(conn: &Connection) -> rusqlite::Result<()> {
    let tx = conn.unchecked_transaction()?;
    schema::create(&tx)?;
    tx.commit()
}

fn connect(path: &Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA foreign_keys = ON;
         PRAGMA busy_timeout = 5000;",
    )?;
    Ok(conn)
}

fn corrupt(error: impl std::fmt::Display) -> OpenError {
    OpenError::Corrupt(error.to_string())
}
