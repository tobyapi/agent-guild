//! 発言のリポジトリ。並びとページングは seq（INTEGER PRIMARY KEY AUTOINCREMENT）。

use std::sync::Arc;

use guild_application::ports::{MessageFilter, MessageRepository};
use guild_application::AppResult;
use guild_domain::author::Author;
use guild_domain::delegation::Delegation;
use guild_domain::ids::{ChannelId, DelegationId, MessageId};
use guild_domain::message::{Message, MessageKind, NewMessage};
use rusqlite::{params, params_from_iter, Connection, OptionalExtension, Row};

use super::codec::{json_column, parsed_column, storage, to_json};
use super::database::Database;

/// read_message が読む列（この順）
const COLUMNS: &str = "seq,id,channel_id,author_id,content,
    (SELECT json_group_array(json_object('id',attachment_id,'name',name,'mediaType',media_type,'size',size_bytes))
     FROM (SELECT * FROM message_attachments WHERE message_id=messages.id ORDER BY position)),
    kind,(SELECT json_group_array(actor_id) FROM
          (SELECT actor_id FROM message_mentions WHERE message_id=messages.id ORDER BY position)),
    reply_to_id,root_id,depth,(SELECT id FROM delegations WHERE source_message_id=messages.id),created_at,skill_usage_json";

pub struct SqliteMessageRepository {
    db: Arc<Database>,
}

impl SqliteMessageRepository {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }
}

impl MessageRepository for SqliteMessageRepository {
    fn publish(&self, message: NewMessage, delegation: Option<&Delegation>) -> AppResult<Message> {
        let seq = self
            .db
            .with(|conn| {
                let tx = conn.unchecked_transaction()?;
                let seq = store_message(&tx, &message)?;
                if let Some(delegation) = delegation {
                    super::delegation_rows::insert_rows(&tx, delegation)?;
                }
                tx.commit()?;
                Ok(seq)
            })
            .map_err(storage)?;
        Ok(message.into_message(seq))
    }

    fn get(&self, id: &MessageId) -> AppResult<Option<Message>> {
        self.db
            .with(|conn| {
                conn.query_row(
                    &format!("SELECT {COLUMNS} FROM messages WHERE id = ?1"),
                    params![id.as_str()],
                    read_message,
                )
                .optional()
            })
            .map_err(storage)
    }

    fn list(
        &self,
        channel: &ChannelId,
        filter: MessageFilter,
        before_seq: Option<i64>,
        limit: usize,
    ) -> AppResult<Vec<Message>> {
        let limit = i64::try_from(limit).unwrap_or(i64::MAX);
        let sql = format!(
            "SELECT {COLUMNS} FROM messages WHERE channel_id = ?1 AND seq < ?2{} ORDER BY seq DESC LIMIT ?3",
            kind_clause(filter)
        );
        let mut messages: Vec<Message> = self
            .db
            .with(|conn| {
                conn.prepare(&sql)?
                    .query_map(params![channel.as_str(), before_seq.unwrap_or(i64::MAX), limit], read_message)?
                    .collect()
            })
            .map_err(storage)?;
        messages.reverse();
        Ok(messages)
    }

    fn list_in_conversations(
        &self,
        channel: &ChannelId,
        roots: &[MessageId],
        filter: MessageFilter,
        limit: usize,
    ) -> AppResult<Vec<Message>> {
        if roots.is_empty() {
            return Ok(Vec::new());
        }
        let placeholders: Vec<String> = (0..roots.len()).map(|index| format!("?{}", index + 2)).collect();
        let sql = format!(
            "SELECT {COLUMNS} FROM messages WHERE channel_id = ?1 AND root_id IN ({}){} ORDER BY seq DESC LIMIT {}",
            placeholders.join(", "),
            kind_clause(filter),
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

pub(super) fn store_message(conn: &Connection, m: &NewMessage) -> rusqlite::Result<i64> {
    let reply = m.reply_to_id.as_ref().map(MessageId::as_str);
    let inserted = conn.execute(
        "INSERT INTO messages
        (id,channel_id,author_id,content,kind,reply_to_id,root_id,depth,created_at,skill_usage_json)
        SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9,?10
        WHERE (?6 IS NULL OR EXISTS (SELECT 1 FROM messages WHERE id=?6 AND channel_id=?2))
        AND (?7=?1 OR EXISTS (SELECT 1 FROM messages WHERE id=?7 AND channel_id=?2))",
        params![
            m.id.as_str(),
            m.channel_id.as_str(),
            m.author_id.as_str(),
            m.content,
            m.kind.as_str(),
            reply,
            m.root_id.as_str(),
            m.depth,
            m.created_at,
            m.skill_usage.as_ref().map(to_json).transpose()?
        ],
    )?;
    if inserted != 1 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }
    let seq = conn.last_insert_rowid();
    for (position, a) in (0_i64..).zip(m.attachments.iter()) {
        conn.execute(
            "INSERT INTO message_attachments (message_id,position,attachment_id,name,media_type,size_bytes)
            VALUES (?1,?2,?3,?4,?5,?6)",
            params![
                m.id.as_str(),
                position,
                a.id.as_str(),
                a.name,
                a.media_type,
                i64::try_from(a.size).map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?
            ],
        )?;
    }
    for (position, agent) in (0_i64..).zip(m.mentions.iter()) {
        conn.execute(
            "INSERT INTO message_mentions (message_id,position,actor_id) VALUES (?1,?2,?3)",
            params![m.id.as_str(), position, agent.as_str()],
        )?;
    }
    Ok(seq)
}

/// 種類での絞り込みを WHERE に足す句（値は固定の識別子だけ）
fn kind_clause(filter: MessageFilter) -> String {
    let progress = MessageKind::Progress.as_str();
    match filter {
        MessageFilter::All => String::new(),
        MessageFilter::WithoutProgress => format!(" AND kind <> '{progress}'"),
        MessageFilter::ProgressOnly => format!(" AND kind = '{progress}'"),
    }
}

fn read_message(row: &Row<'_>) -> rusqlite::Result<Message> {
    Ok(Message {
        seq: row.get(0)?,
        id: MessageId::new(row.get::<_, String>(1)?),
        channel_id: ChannelId::new(row.get::<_, String>(2)?),
        author_id: Author::from(row.get::<_, String>(3)?),
        content: row.get(4)?,
        skill_usage: row
            .get::<_, Option<String>>(13)?
            .map(|json| serde_json::from_str(&json))
            .transpose()
            .map_err(|error| {
                rusqlite::Error::FromSqlConversionFailure(13, rusqlite::types::Type::Text, Box::new(error))
            })?
            .flatten(),
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
