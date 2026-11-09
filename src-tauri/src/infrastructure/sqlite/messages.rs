//! 発言のリポジトリ。並びとページングは seq（INTEGER PRIMARY KEY AUTOINCREMENT）。

use std::sync::Arc;

use guild_application::ports::MessageRepository;
use guild_application::AppResult;
use guild_domain::author::Author;
use guild_domain::ids::{ChannelId, DelegationId, MessageId};
use guild_domain::message::{Message, MessageKind, NewMessage};
use rusqlite::{params, params_from_iter, OptionalExtension, Row};

use super::codec::{json_column, parsed_column, storage, to_json};
use super::database::Database;

/// read_message が読む列（この順）
const COLUMNS: &str = "seq, id, channel_id, author_id, content, attachments, kind, mentions, reply_to_id, root_id, \
                       depth, delegation_id, created_at";

pub struct SqliteMessageRepository {
    db: Arc<Database>,
}

impl SqliteMessageRepository {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }
}

impl MessageRepository for SqliteMessageRepository {
    fn insert(&self, message: NewMessage) -> AppResult<Message> {
        let seq = self
            .db
            .with(|conn| {
                conn.execute(
                    "INSERT INTO messages (id, channel_id, author_id, content, attachments, kind, mentions, reply_to_id, \
                     root_id, depth, delegation_id, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                    params![
                        message.id.as_str(),
                        message.channel_id.as_str(),
                        message.author_id.as_str(),
                        message.content,
                        to_json(&message.attachments)?,
                        message.kind.as_str(),
                        to_json(&message.mentions)?,
                        message.reply_to_id.as_ref().map(MessageId::as_str),
                        message.root_id.as_str(),
                        message.depth,
                        message.delegation_id.as_ref().map(DelegationId::as_str),
                        message.created_at,
                    ],
                )?;
                Ok(conn.last_insert_rowid())
            })
            .map_err(storage)?;
        Ok(message.into_message(seq))
    }

    fn get(&self, id: &MessageId) -> AppResult<Option<Message>> {
        self.db
            .with(|conn| {
                conn.query_row(&format!("SELECT {COLUMNS} FROM messages WHERE id = ?1"), params![id.as_str()], read_message)
                    .optional()
            })
            .map_err(storage)
    }

    fn list(&self, channel: &ChannelId, before_seq: Option<i64>, limit: usize) -> AppResult<Vec<Message>> {
        let limit = i64::try_from(limit).unwrap_or(i64::MAX);
        let mut messages: Vec<Message> = self
            .db
            .with(|conn| {
                conn.prepare(&format!(
                    "SELECT {COLUMNS} FROM messages WHERE channel_id = ?1 AND seq < ?2 ORDER BY seq DESC LIMIT ?3"
                ))?
                .query_map(params![channel.as_str(), before_seq.unwrap_or(i64::MAX), limit], read_message)?
                .collect()
            })
            .map_err(storage)?;
        messages.reverse();
        Ok(messages)
    }

    fn list_in_conversations(&self, channel: &ChannelId, roots: &[MessageId], limit: usize) -> AppResult<Vec<Message>> {
        if roots.is_empty() {
            return Ok(Vec::new());
        }
        let placeholders: Vec<String> = (0..roots.len()).map(|index| format!("?{}", index + 2)).collect();
        let sql = format!(
            "SELECT {COLUMNS} FROM messages WHERE channel_id = ?1 AND root_id IN ({}) ORDER BY seq DESC LIMIT {}",
            placeholders.join(", "),
            i64::try_from(limit).unwrap_or(i64::MAX)
        );
        let values: Vec<&str> = std::iter::once(channel.as_str()).chain(roots.iter().map(MessageId::as_str)).collect();
        let mut messages: Vec<Message> = self
            .db
            .with(|conn| conn.prepare(&sql)?.query_map(params_from_iter(values.iter()), read_message)?.collect())
            .map_err(storage)?;
        messages.reverse();
        Ok(messages)
    }
}

fn read_message(row: &Row<'_>) -> rusqlite::Result<Message> {
    Ok(Message {
        seq: row.get(0)?,
        id: MessageId::new(row.get::<_, String>(1)?),
        channel_id: ChannelId::new(row.get::<_, String>(2)?),
        author_id: Author::from(row.get::<_, String>(3)?),
        content: row.get(4)?,
        attachments: json_column(row, 5)?,
        kind: parsed_column(row, 6, MessageKind::parse)?,
        mentions: json_column(row, 7)?,
        reply_to_id: row.get::<_, Option<String>>(8)?.map(MessageId::new),
        root_id: MessageId::new(row.get::<_, String>(9)?),
        depth: row.get(10)?,
        delegation_id: row.get::<_, Option<String>>(11)?.map(DelegationId::new),
        created_at: row.get(12)?,
    })
}
