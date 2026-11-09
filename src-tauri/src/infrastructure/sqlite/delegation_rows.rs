//! 割り振りの行の読み書き（delegations 表と subtasks 表）。トランザクションは呼び出し側（delegations.rs）が張る。

use guild_domain::delegation::{Delegation, DelegationStatus, Subtask, SubtaskStatus};
use guild_domain::ids::{AgentId, ChannelId, DelegationId, MessageId, SubtaskId};
use rusqlite::{params, Connection, Row};

use super::codec::parsed_column;

pub(super) const COLUMNS: &str =
    "id, channel_id, manager_id, message_id, status, summary_message_id, created_at, updated_at";

/// 割り振りとサブタスクの行を書く
pub(super) fn insert_rows(conn: &Connection, delegation: &Delegation) -> rusqlite::Result<()> {
    conn.execute(
        &format!("INSERT INTO delegations ({COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"),
        params![
            delegation.id.as_str(),
            delegation.channel_id.as_str(),
            delegation.manager_id.as_str(),
            delegation.message_id.as_str(),
            delegation.status.as_str(),
            delegation.summary_message_id.as_ref().map(MessageId::as_str),
            delegation.created_at,
            delegation.updated_at,
        ],
    )?;
    for (position, subtask) in delegation.subtasks.iter().enumerate() {
        conn.execute(
            "INSERT INTO subtasks (id, delegation_id, position, assignee_id, instruction, status, result_message_id, \
             note) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                subtask.id.as_str(),
                delegation.id.as_str(),
                i64::try_from(position).unwrap_or(i64::MAX),
                subtask.assignee_id.as_str(),
                subtask.instruction,
                subtask.status.as_str(),
                subtask.result_message_id.as_ref().map(MessageId::as_str),
                subtask.note,
            ],
        )?;
    }
    Ok(())
}

/// 状態・まとめ・更新日時と、各サブタスクの状態・結果・理由を書き換える
pub(super) fn update_rows(conn: &Connection, delegation: &Delegation) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE delegations SET status = ?2, summary_message_id = ?3, updated_at = ?4 WHERE id = ?1",
        params![
            delegation.id.as_str(),
            delegation.status.as_str(),
            delegation.summary_message_id.as_ref().map(MessageId::as_str),
            delegation.updated_at,
        ],
    )?;
    for subtask in &delegation.subtasks {
        conn.execute(
            "UPDATE subtasks SET status = ?2, result_message_id = ?3, note = ?4 WHERE id = ?1",
            params![
                subtask.id.as_str(),
                subtask.status.as_str(),
                subtask.result_message_id.as_ref().map(MessageId::as_str),
                subtask.note,
            ],
        )?;
    }
    Ok(())
}

/// サブタスクは空のまま読む（subtasks_of で埋める）
pub(super) fn read_delegation(row: &Row<'_>) -> rusqlite::Result<Delegation> {
    Ok(Delegation {
        id: DelegationId::new(row.get::<_, String>(0)?),
        channel_id: ChannelId::new(row.get::<_, String>(1)?),
        manager_id: AgentId::new(row.get::<_, String>(2)?),
        message_id: MessageId::new(row.get::<_, String>(3)?),
        status: parsed_column(row, 4, DelegationStatus::parse)?,
        subtasks: Vec::new(),
        summary_message_id: row.get::<_, Option<String>>(5)?.map(MessageId::new),
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

/// 書かれた順のサブタスク
pub(super) fn subtasks_of(conn: &Connection, id: &DelegationId) -> rusqlite::Result<Vec<Subtask>> {
    conn.prepare(
        "SELECT id, assignee_id, instruction, status, result_message_id, note FROM subtasks \
         WHERE delegation_id = ?1 ORDER BY position",
    )?
    .query_map([id.as_str()], |row| {
        Ok(Subtask {
            id: SubtaskId::new(row.get::<_, String>(0)?),
            assignee_id: AgentId::new(row.get::<_, String>(1)?),
            instruction: row.get(2)?,
            status: parsed_column(row, 3, SubtaskStatus::parse)?,
            result_message_id: row.get::<_, Option<String>>(4)?.map(MessageId::new),
            note: row.get(5)?,
        })
    })?
    .collect()
}
