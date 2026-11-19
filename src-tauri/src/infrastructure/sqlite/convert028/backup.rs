use super::{fail, source, Result};
use rusqlite::{backup::Backup, Connection};
use std::{
    fs::{self, File},
    path::{Path, PathBuf},
    time::Duration,
};
pub(super) const TABLES: [&str; 13] = [
    "agents",
    "avatar_frames",
    "channel_members",
    "channels",
    "delegations",
    "messages",
    "meta",
    "profile",
    "run_measurements",
    "skill_record_cutoffs",
    "skills",
    "subtasks",
    "sqlite_sequence",
];

pub(super) fn create(src: &Connection, root: &Path) -> Result<PathBuf> {
    let parent = root.join("backups").join("pre-1.0.0");
    fs::create_dir_all(&parent)?;
    let folder = parent.join(format!("{}-{}", chrono::Utc::now().format("%Y%m%dT%H%M%SZ"), uuid::Uuid::new_v4()));
    source::private_dir(&folder)?;
    let partial = folder.join("guild.db.partial");
    let path = folder.join("guild.db");
    {
        let mut dest = Connection::open(&partial)?;
        Backup::new(src, &mut dest)?.run_to_completion(256, Duration::from_millis(1), None)?;
        dest.pragma_update(None, "journal_mode", "DELETE")?;
    }
    {
        let copy = source::read_only(&partial)?;
        if !matches!(super::identity::classify(&copy)?, super::identity::Generation::Legacy) {
            return Err(fail("Invalid backup header"));
        }
        integrity(&copy)?;
    }
    src.execute("ATTACH DATABASE ?1 AS verified", [source::uri(&partial)?])?;
    let result = compare(src, "verified");
    src.execute_batch("DETACH verified")?;
    result?;
    File::options().read(true).write(true).open(&partial)?.sync_all()?;
    #[cfg(test)]
    super::fault("before-backup");
    publish(&partial, &path)?;
    #[cfg(unix)]
    for dir in [&folder, &parent, &root.join("backups"), root] {
        File::open(dir)?.sync_all()?;
    }
    Ok(path)
}
#[cfg(not(windows))]
fn publish(from: &Path, to: &Path) -> std::io::Result<()> {
    fs::rename(from, to)
}
#[cfg(windows)]
fn publish(from: &Path, to: &Path) -> std::io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{MoveFileExW, MOVEFILE_WRITE_THROUGH};
    let wide = |p: &Path| p.as_os_str().encode_wide().chain(Some(0)).collect::<Vec<_>>();
    // Both UTF-16 buffers remain alive for the synchronous call; the unique destination must not exist.
    if unsafe { MoveFileExW(wide(from).as_ptr(), wide(to).as_ptr(), MOVEFILE_WRITE_THROUGH) } == 0 {
        return Err(std::io::Error::last_os_error());
    }
    Ok(())
}

pub(super) fn integrity(conn: &Connection) -> Result<()> {
    let status: String = conn.query_row("PRAGMA main.integrity_check", [], |r| r.get(0))?;
    if status != "ok" {
        return Err(fail(format!("integrity_check: {status}")));
    }
    if let Some(item) = conn.prepare("PRAGMA main.foreign_key_check")?.query([])?.next()? {
        return Err(fail(format!("foreign_key_check: {} row {}", item.get::<_, String>(0)?, item.get::<_, i64>(1)?)));
    }
    Ok(())
}
/// Compare every cell including implicit rowids and the AUTOINCREMENT high-water mark.
pub(super) fn compare(conn: &Connection, other: &str) -> Result<()> {
    for table in TABLES {
        let a = format!("SELECT rowid,* FROM main.{table}");
        let b = format!("SELECT rowid,* FROM {other}.{table}");
        let same: bool =
            conn.query_row(&format!("SELECT NOT EXISTS({a} EXCEPT {b}) AND NOT EXISTS({b} EXCEPT {a})"), [], |r| {
                r.get(0)
            })?;
        if !same {
            return Err(fail(format!("Backup mismatch: {table}")));
        }
    }
    Ok(())
}
