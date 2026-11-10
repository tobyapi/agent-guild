//! 順序付きマイグレーション（`PRAGMA user_version`）とスキーマ指紋（meta 表）。
//! 適用済みの移行の中身が今のコードと違えば `fingerprint_matches` が false になり、Database::open が
//! デバッグビルドでは古い DB を退避して作り直す（リリースビルドでは決してしない）。

use rusqlite::{params, Connection, OptionalExtension};

/// 自分の DB である印（PRAGMA application_id。"GUIL"）
pub const APPLICATION_ID: i32 = 0x4755_494C;

/// 移行の一覧（index + 1 が user_version）
const MIGRATIONS: &[&str] =
    &[include_str!("migrations/0001_init.sql"), include_str!("migrations/0002_run_measurements.sql")];

/// 移行の仕組みが使う表（指紋・初期データの記録）。移行の外で作る
const META_TABLE: &str = "CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)";
const FINGERPRINT_KEY: &str = "schema_fingerprint";

/// 最新のスキーマの版
pub fn latest_version() -> usize {
    MIGRATIONS.len()
}

pub fn application_id(conn: &Connection) -> rusqlite::Result<i32> {
    conn.query_row("PRAGMA application_id", [], |row| row.get(0))
}

pub fn applied_version(conn: &Connection) -> rusqlite::Result<usize> {
    let version: i64 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;
    Ok(usize::try_from(version).unwrap_or(usize::MAX))
}

/// 適用済みの移行の指紋が、今のコードの同じ範囲の指紋と一致するか
pub fn fingerprint_matches(conn: &Connection, version: usize) -> rusqlite::Result<bool> {
    let has_meta: bool = conn.query_row(
        "SELECT EXISTS (SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'meta')",
        [],
        |row| row.get(0),
    )?;
    if !has_meta {
        return Ok(false);
    }
    let stored: Option<String> = conn
        .query_row("SELECT value FROM meta WHERE key = ?1", params![FINGERPRINT_KEY], |row| row.get(0))
        .optional()?;
    Ok(stored.as_deref() == Some(fingerprint(version).as_str()))
}

/// 未適用の移行をトランザクションで順に当てる（新規なら application_id も書く）
pub fn migrate(conn: &Connection) -> rusqlite::Result<()> {
    let version = applied_version(conn)?;
    for (index, sql) in MIGRATIONS.iter().enumerate().skip(version) {
        let tx = conn.unchecked_transaction()?;
        if index == 0 {
            tx.pragma_update(None, "application_id", APPLICATION_ID)?;
        }
        tx.execute_batch(META_TABLE)?;
        tx.execute_batch(sql)?;
        let applied = index + 1;
        tx.pragma_update(None, "user_version", i64::try_from(applied).unwrap_or(i64::MAX))?;
        tx.execute(
            "INSERT INTO meta (key, value) VALUES (?1, ?2) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
            params![FINGERPRINT_KEY, fingerprint(applied)],
        )?;
        tx.commit()?;
    }
    Ok(())
}

/// 先頭 count 本の移行の指紋（FNV-1a 64bit。改行コードの違いは無視する）
fn fingerprint(count: usize) -> String {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for sql in MIGRATIONS.iter().take(count) {
        for byte in sql.replace("\r\n", "\n").bytes().chain(std::iter::once(0)) {
            hash ^= u64::from(byte);
            hash = hash.wrapping_mul(0x0100_0000_01b3);
        }
    }
    format!("{hash:016x}")
}
