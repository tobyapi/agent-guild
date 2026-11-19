//! チャンネルとメンバーのリポジトリ。メンバーは参加順（position の順）。

use std::sync::Arc;

use guild_application::ports::ChannelRepository;
use guild_application::AppResult;
use guild_domain::author::MemberId;
use guild_domain::channel::Channel;
use guild_domain::ids::ChannelId;
use rusqlite::{params, Connection, OptionalExtension, Row};

use super::codec::storage;
use super::database::Database;

pub struct SqliteChannelRepository {
    db: Arc<Database>,
}

impl SqliteChannelRepository {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }
}

impl ChannelRepository for SqliteChannelRepository {
    fn list(&self) -> AppResult<Vec<Channel>> {
        self.db
            .with(|conn| {
                let mut channels: Vec<Channel> = conn
                    .prepare("SELECT id, name, topic, created_at, is_lobby, history_after_seq, guard_old_roots, icon FROM channels ORDER BY created_at, rowid")?
                    .query_map([], read_channel)?
                    .collect::<rusqlite::Result<_>>()?;
                let mut members = conn.prepare("SELECT channel_id, actor_id FROM channel_members ORDER BY channel_id,position")?;
                let rows = members.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))?;
                for row in rows {
                    let (channel_id, member) = row?;
                    if let Some(channel) = channels.iter_mut().find(|c| c.id.as_str() == channel_id) {
                        channel.member_ids.push(MemberId::from(member));
                    }
                }
                Ok(channels)
            })
            .map_err(storage)
    }

    fn get(&self, id: &ChannelId) -> AppResult<Option<Channel>> {
        self.db
            .with(|conn| {
                let sql =
                    "SELECT id, name, topic, created_at, is_lobby, history_after_seq, guard_old_roots, icon FROM channels WHERE id = ?1";
                let Some(mut channel) = conn.query_row(sql, [id.as_str()], read_channel).optional()? else {
                    return Ok(None);
                };
                channel.member_ids = members_of(conn, id)?;
                Ok(Some(channel))
            })
            .map_err(storage)
    }

    fn insert(&self, channel: &Channel) -> AppResult<()> {
        self.db
            .with(|conn| {
                let tx = conn.unchecked_transaction()?;
                insert_channel(&tx, channel)?;
                tx.commit()
            })
            .map_err(storage)
    }

    fn update(&self, channel: &Channel) -> AppResult<()> {
        self.db
            .with(|conn| {
                conn.execute(
                    "UPDATE channels SET name = ?2, topic = ?3, is_lobby = ?4, icon = ?5 WHERE id = ?1",
                    params![channel.id.as_str(), channel.name, channel.topic, channel.is_lobby, channel.icon],
                )
            })
            .map(|_| ())
            .map_err(storage)
    }

    /// メンバーと発言は外部キーの ON DELETE CASCADE で消える
    fn delete(&self, id: &ChannelId) -> AppResult<()> {
        self.db
            .with(|conn| conn.execute("DELETE FROM channels WHERE id = ?1", [id.as_str()]))
            .map(|_| ())
            .map_err(storage)
    }

    fn add_member(&self, id: &ChannelId, member: &MemberId) -> AppResult<()> {
        self.db.with(|conn| add(conn, id, member)).map_err(storage)
    }

    fn remove_member(&self, id: &ChannelId, member: &MemberId) -> AppResult<()> {
        self.db
            .with(|conn| {
                conn.execute(
                    "DELETE FROM channel_members WHERE channel_id = ?1 AND actor_id = ?2",
                    params![id.as_str(), member.as_str()],
                )
            })
            .map(|_| ())
            .map_err(storage)
    }

    fn remove_member_everywhere(&self, member: &MemberId) -> AppResult<()> {
        self.db
            .with(|conn| conn.execute("DELETE FROM channel_members WHERE actor_id = ?1", [member.as_str()]))
            .map(|_| ())
            .map_err(storage)
    }
}

pub(super) fn insert_channel(conn: &Connection, channel: &Channel) -> rusqlite::Result<()> {
    conn.execute(
                    "INSERT INTO channels (id, name, topic, created_at, is_lobby, history_after_seq, guard_old_roots, icon) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    params![channel.id.as_str(), channel.name, channel.topic, channel.created_at, channel.is_lobby, channel.history_after_seq, channel.guard_old_roots, channel.icon],
                )?;
    for member in &channel.member_ids {
        add(conn, &channel.id, member)?;
    }
    Ok(())
}

/// 参加済みなら何もしない
fn add(conn: &Connection, id: &ChannelId, member: &MemberId) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO channel_members (channel_id,actor_id,position) SELECT ?1,?2,coalesce(max(position)+1,0) FROM channel_members WHERE channel_id=?1 ON CONFLICT(channel_id,actor_id) DO NOTHING",
        params![id.as_str(), member.as_str()],
    )?;
    Ok(())
}

fn members_of(conn: &Connection, id: &ChannelId) -> rusqlite::Result<Vec<MemberId>> {
    conn.prepare("SELECT actor_id FROM channel_members WHERE channel_id = ?1 ORDER BY position")?
        .query_map([id.as_str()], |row| row.get::<_, String>(0).map(MemberId::from))?
        .collect()
}

fn read_channel(row: &Row<'_>) -> rusqlite::Result<Channel> {
    Ok(Channel {
        history_after_seq: row.get::<_, Option<i64>>(5)?.unwrap_or(0),
        guard_old_roots: row.get(6)?,
        id: ChannelId::new(row.get::<_, String>(0)?),
        name: row.get(1)?,
        topic: row.get(2)?,
        icon: row.get(7)?,
        member_ids: Vec::new(),
        created_at: row.get(3)?,
        is_lobby: row.get(4)?,
    })
}
