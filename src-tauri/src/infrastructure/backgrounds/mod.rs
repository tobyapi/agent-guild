//! Metadata-free image library at <dataDir>/backgrounds/<UUID>.png.
mod raster;
#[cfg(test)]
mod tests;

use super::data_dir::BACKGROUNDS_DIR;
use guild_application::backgrounds::BackgroundStore;
use guild_application::{AppError, AppResult};
use std::fs::{self, OpenOptions};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};

pub struct FsBackgrounds {
    root: PathBuf,
}
impl FsBackgrounds {
    pub fn new(data_dir: &Path) -> Self {
        Self { root: data_dir.join(BACKGROUNDS_DIR) }
    }

    fn path(&self, id: &str) -> AppResult<PathBuf> {
        validate_id(id)?;
        self.check_root()?;
        let path = self.root.join(format!("{id}.png"));
        match fs::symlink_metadata(&path) {
            Ok(meta) if !meta.is_file() || meta.file_type().is_symlink() => {
                return Err(AppError::validation("Background image must be a regular file"))
            }
            Err(e) if e.kind() != io::ErrorKind::NotFound => return Err(storage(e)),
            _ => (),
        }
        Ok(path)
    }

    fn check_root(&self) -> AppResult<()> {
        match fs::symlink_metadata(&self.root) {
            Ok(meta) if !meta.is_dir() || meta.file_type().is_symlink() => {
                Err(AppError::validation("Background library must be a regular directory"))
            }
            Err(e) if e.kind() != io::ErrorKind::NotFound => Err(storage(e)),
            _ => Ok(()),
        }
    }
}

impl BackgroundStore for FsBackgrounds {
    fn import(&self, bytes: &[u8]) -> AppResult<String> {
        let png = raster::prepare(bytes)?;
        let id = uuid::Uuid::new_v4().to_string();
        let path = self.path(&id)?;
        fs::create_dir_all(&self.root).map_err(storage)?;
        let temp = path.with_extension("png.tmp");
        let mut file = OpenOptions::new().write(true).create_new(true).open(&temp).map_err(storage)?;
        let result = (|| {
            file.write_all(&png)?;
            file.sync_all()?;
            drop(file);
            fs::rename(&temp, path)
        })();
        if let Err(error) = result {
            let _ = fs::remove_file(&temp);
            return Err(storage(error));
        }
        Ok(id)
    }

    fn list(&self) -> AppResult<Vec<String>> {
        self.check_root()?;
        let entries = match fs::read_dir(&self.root) {
            Ok(entries) => entries,
            Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(e) => return Err(storage(e)),
        };
        let mut ids = Vec::new();
        for entry in entries {
            let entry = entry.map_err(storage)?;
            let name = entry.file_name();
            let Some(id) = name.to_str().and_then(|name| name.strip_suffix(".png")) else { continue };
            if validate_id(id).is_ok() && entry.file_type().map_err(storage)?.is_file() {
                ids.push(id.to_owned());
            }
        }
        ids.sort();
        Ok(ids)
    }

    fn read(&self, id: &str) -> AppResult<Vec<u8>> {
        let path = self.path(id)?;
        let file = fs::File::open(path).map_err(|e| {
            if e.kind() == io::ErrorKind::NotFound {
                AppError::NotFound("Background image")
            } else {
                storage(e)
            }
        })?;
        // Even a manually replaced file cannot cause an unbounded IPC allocation.
        let mut bytes = Vec::new();
        file.take(32 * 1024 * 1024 + 1).read_to_end(&mut bytes).map_err(storage)?;
        if bytes.len() > 32 * 1024 * 1024 {
            return Err(AppError::validation("Stored background image exceeds 32 MiB"));
        }
        Ok(bytes)
    }

    fn delete(&self, id: &str) -> AppResult<()> {
        match fs::remove_file(self.path(id)?) {
            Err(e) if e.kind() != io::ErrorKind::NotFound => Err(storage(e)),
            _ => Ok(()),
        }
    }
}

fn validate_id(id: &str) -> AppResult<()> {
    if uuid::Uuid::parse_str(id).is_ok_and(|uuid| uuid.to_string() == id) {
        Ok(())
    } else {
        Err(AppError::validation("Invalid background image ID"))
    }
}
fn storage(_: io::Error) -> AppError {
    AppError::Storage("Cannot access the background image library".into())
}
