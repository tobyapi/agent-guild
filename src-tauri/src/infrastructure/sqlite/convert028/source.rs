//! Inspect a stable snapshot under the caller's data-directory lock. SQLite may recover only the private copy.
use super::{fail, Result};
use rusqlite::{Connection, OpenFlags};
use std::{
    fs, io,
    path::{Path, PathBuf},
};

pub(super) struct Snapshot {
    pub db: Connection,
    _temporary: Option<Temporary>,
}
struct Temporary(PathBuf);
impl Drop for Temporary {
    fn drop(&mut self) {
        if let Err(e) = fs::remove_dir_all(&self.0) {
            log::warn!("Temporary SQLite snapshot: {e}");
        }
    }
}

pub(super) fn uri(path: &Path) -> Result<String> {
    let path = fs::canonicalize(path)?;
    let mut url = tauri::Url::from_file_path(&path).map_err(|()| fail("Invalid SQLite path"))?;
    url.set_query(Some("mode=ro&immutable=1"));
    Ok(url.to_string())
}
pub(super) fn read_only(path: &Path) -> Result<Connection> {
    Ok(Connection::open_with_flags(uri(path)?, OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_URI)?)
}

pub(super) fn private_dir(path: &Path) -> io::Result<()> {
    let mut builder = fs::DirBuilder::new();
    #[cfg(unix)]
    {
        use std::os::unix::fs::DirBuilderExt;
        builder.mode(0o700);
    }
    #[cfg(not(unix))]
    {
        builder.recursive(false);
    }
    builder.create(path)
}
fn sidecar(path: &Path, end: &str) -> PathBuf {
    let mut out = path.as_os_str().to_owned();
    out.push(end);
    out.into()
}

impl Snapshot {
    pub fn open(path: &Path) -> Result<Self> {
        if fs::metadata(path)?.len() == 0 {
            return Err(fail("Empty database file"));
        }
        let wal = sidecar(path, "-wal").try_exists()?;
        let journal = sidecar(path, "-journal").try_exists()?;
        // The SHM is a derived WAL index. Without a WAL it contains no committed pages.
        if wal && journal {
            return Err(fail("Unrecognized SQLite journal files"));
        }
        if !wal && !journal {
            return Ok(Self { db: read_only(path)?, _temporary: None });
        }
        let root = std::env::temp_dir().join(format!("agent-guild-db-{}", uuid::Uuid::new_v4()));
        private_dir(&root)?;
        let temp = Temporary(root);
        let target = temp.0.join("guild.db");
        fs::copy(path, &target)?;
        let suffix = if wal { "-wal" } else { "-journal" };
        fs::copy(sidecar(path, suffix), sidecar(&target, suffix))?;
        let db = Connection::open(&target)?;
        // The first read recovers a hot rollback journal or reconstructs the WAL index.
        db.query_row("SELECT count(*) FROM sqlite_schema", [], |_| Ok(()))?;
        db.pragma_update(None, "query_only", true)?;
        Ok(Self { db, _temporary: Some(temp) })
    }
}
