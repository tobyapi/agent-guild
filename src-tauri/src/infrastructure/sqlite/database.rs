//! SQLite の接続。1接続を Mutex で守り（WAL）、各リポジトリはこの Database を共有する。
//! 開くときに自分の DB か（application_id）・新しすぎないか（user_version）・壊れていないかを確かめる。

use std::path::Path;

use parking_lot::Mutex;
use rusqlite::{Connection, OpenFlags};

use super::migrations::{self, APPLICATION_ID};
use super::reset;

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

/// 開いた DB が何者か
enum Identity {
    /// 空（新規作成）
    Fresh,
    /// この版で開ける（未適用の移行があれば当てる）
    Known,
    /// 適用済みの移行の中身が変わっている（リリース前の開発中だけ起きる）
    Outdated,
    Newer(usize),
    Foreign,
}

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    /// ファイルを開いて移行を当てる。指紋が合わなければ、デバッグビルドでは古い DB を
    /// `guild.db.bak-<日時>` に退避して作り直す（リリースビルドでは Corrupt）
    pub fn open(path: &Path) -> Result<Self, OpenError> {
        let conn = connect(path).map_err(corrupt)?;
        match identify(&conn).map_err(corrupt)? {
            Identity::Foreign => Err(OpenError::Foreign),
            Identity::Newer(version) => Err(OpenError::Newer(version)),
            Identity::Outdated if cfg!(debug_assertions) => {
                drop(conn);
                let timestamp = chrono::Local::now().format("%Y%m%d-%H%M%S").to_string();
                let backup = reset::move_aside(path, &timestamp).map_err(|e| OpenError::Corrupt(e.to_string()))?;
                log::warn!("スキーマが変わったので、古いデータベースを {} に退避して作り直します", backup.display());
                Self::init(connect(path).map_err(corrupt)?)
            }
            Identity::Outdated => Err(OpenError::Corrupt(messages::fingerprint_mismatch())),
            Identity::Fresh | Identity::Known => Self::init(conn),
        }
    }

    /// テスト用のメモリ上のデータベース
    pub fn open_in_memory() -> Result<Self, OpenError> {
        let conn = Connection::open_in_memory().map_err(corrupt)?;
        conn.execute_batch("PRAGMA foreign_keys = ON;").map_err(corrupt)?;
        Self::init(conn)
    }

    fn init(conn: Connection) -> Result<Self, OpenError> {
        migrations::migrate(&conn).map_err(corrupt)?;
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
    match identify(&conn).map_err(corrupt)? {
        Identity::Foreign => Err(OpenError::Foreign),
        Identity::Newer(version) => Err(OpenError::Newer(version)),
        Identity::Outdated if !cfg!(debug_assertions) => Err(OpenError::Corrupt(messages::fingerprint_mismatch())),
        _ => Ok(()),
    }
}

fn identify(conn: &Connection) -> rusqlite::Result<Identity> {
    let application_id = migrations::application_id(conn)?;
    let version = migrations::applied_version(conn)?;
    if application_id == 0 && version == 0 {
        let has_tables: bool =
            conn.query_row("SELECT EXISTS (SELECT 1 FROM sqlite_master WHERE type = 'table')", [], |row| row.get(0))?;
        return Ok(if has_tables { Identity::Foreign } else { Identity::Fresh });
    }
    if application_id != APPLICATION_ID {
        return Ok(Identity::Foreign);
    }
    if version > migrations::latest_version() {
        return Ok(Identity::Newer(version));
    }
    if migrations::fingerprint_matches(conn, version)? {
        Ok(Identity::Known)
    } else {
        Ok(Identity::Outdated)
    }
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

fn corrupt(error: rusqlite::Error) -> OpenError {
    OpenError::Corrupt(error.to_string())
}
