//! 1行だけの表のリポジトリ: 人間のプロフィール（profile 表）と、記録（meta 表: 指紋・初期データ投入など）。

use std::sync::Arc;

use guild_application::ports::{MetaRepository, ProfileRepository};
use guild_application::AppResult;
use guild_domain::profile::Profile;
use rusqlite::{params, OptionalExtension};

use super::codec::storage;
use super::database::Database;

pub struct SqliteProfileRepository {
    db: Arc<Database>,
}

impl SqliteProfileRepository {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }
}

impl ProfileRepository for SqliteProfileRepository {
    /// まだ保存していなければ既定のプロフィール
    fn get(&self) -> AppResult<Profile> {
        let stored = self
            .db
            .with(|conn| {
                conn.query_row("SELECT name, avatar, color, frame FROM profile WHERE id = 1", [], |row| {
                    Ok(Profile { name: row.get(0)?, avatar: row.get(1)?, color: row.get(2)?, frame: row.get(3)? })
                })
                .optional()
            })
            .map_err(storage)?;
        Ok(stored.unwrap_or_default())
    }

    fn set(&self, profile: &Profile) -> AppResult<()> {
        self.db
            .with(|conn| {
                conn.execute(
                    "INSERT INTO profile (id, name, avatar, color, frame) VALUES (1, ?1, ?2, ?3, ?4) \
                     ON CONFLICT (id) DO UPDATE SET name = excluded.name, avatar = excluded.avatar, \
                     color = excluded.color, frame = excluded.frame",
                    params![profile.name, profile.avatar, profile.color, profile.frame],
                )
            })
            .map(|_| ())
            .map_err(storage)
    }
}

pub struct SqliteMetaRepository {
    db: Arc<Database>,
}

impl SqliteMetaRepository {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }
}

impl MetaRepository for SqliteMetaRepository {
    fn get(&self, key: &str) -> AppResult<Option<String>> {
        self.db
            .with(|conn| conn.query_row("SELECT value FROM meta WHERE key = ?1", [key], |row| row.get(0)).optional())
            .map_err(storage)
    }

    fn set(&self, key: &str, value: &str) -> AppResult<()> {
        self.db
            .with(|conn| {
                conn.execute(
                    "INSERT INTO meta (key, value) VALUES (?1, ?2) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
                    params![key, value],
                )
            })
            .map(|_| ())
            .map_err(storage)
    }
}
