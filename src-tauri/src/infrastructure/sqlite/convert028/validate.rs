use super::{fail, Result};
use guild_domain::{attachment::Attachment, skill_usage::SkillUsage};
use rusqlite::{Connection, OptionalExtension};

/// Reject legacy values which would otherwise be silently discarded by projecting JSON or by reversing a relation.
pub(super) fn legacy(db: &Connection) -> Result<()> {
    let issue = db
        .query_row(include_str!("preflight.sql"), [], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?))
        })
        .optional()?;
    if let Some((table, id)) = issue {
        return Err(fail(format!("{table}: {}", id.as_deref().unwrap_or("NULL"))));
    }
    if let Some(name) = db
        .query_row("SELECT json_extract(value,'$.name') FROM meta WHERE key='guild_profile'", [], |row| {
            row.get::<_, String>(0)
        })
        .optional()?
    {
        use guild_domain::guild::{normalize_guild, GuildProfile};
        let profile = GuildProfile { name, ..GuildProfile::default() };
        let normalized = normalize_guild(profile.clone()).map_err(|e| fail(format!("meta.guild_profile: {e}")))?;
        if normalized != profile {
            return Err(fail("meta.guild_profile: invalid stored name"));
        }
    }
    check_messages(db)
}

fn check_messages(db: &Connection) -> Result<()> {
    let mut st = db.prepare(
        "SELECT id,attachments,skill_usage FROM messages WHERE attachments<>'[]' OR skill_usage IS NOT NULL",
    )?;
    let mut rows = st.query([])?;
    while let Some(row) = rows.next()? {
        let id: String = row.get(0)?;
        let items: Vec<Attachment> = serde_json::from_str(&row.get::<_, String>(1)?)
            .map_err(|e| fail(format!("messages.attachments {id}: {e}")))?;
        if items.iter().any(|item| item.size > i64::MAX as u64) {
            return Err(fail(format!("messages.attachments {id}: size exceeds SQLite integer range")));
        }
        if let Some(raw) = row.get::<_, Option<String>>(2)? {
            serde_json::from_str::<Option<SkillUsage>>(&raw)
                .map_err(|e| fail(format!("messages.skill_usage {id}: {e}")))?;
        }
    }
    Ok(())
}

pub(super) fn converted(db: &Connection) -> Result<()> {
    for (new, old, id) in [
        ("agents", "agents", "id"),
        ("skills", "skills", "id"),
        ("channels", "channels", "id"),
        ("user_profile", "profile", "id"),
        ("messages", "messages", "seq,id"),
        ("delegations", "delegations", "id"),
        ("subtasks", "subtasks", "id"),
        (
            "avatar_frames",
            "avatar_frames WHERE id NOT IN (SELECT id FROM temp.frame_repairs WHERE svg_text IS NULL)",
            "id",
        ),
        ("run_measurements", "run_measurements", "job_id"),
        ("skill_record_cutoffs", "skill_record_cutoffs", "job_id"),
        ("sqlite_sequence", "sqlite_sequence", "name,seq"),
    ] {
        let a = format!("SELECT {id} FROM main.{new}");
        let b = format!("SELECT {id} FROM legacy.{old}");
        let ok: bool =
            db.query_row(&format!("SELECT NOT EXISTS({a} EXCEPT {b}) AND NOT EXISTS({b} EXCEPT {a})"), [], |r| {
                r.get(0)
            })?;
        if !ok {
            return Err(fail(format!("Converted identity mismatch: {new}")));
        }
    }
    for (new, old) in [
        ("actors", "SELECT count(*)+2 FROM legacy.agents"),
        ("agent_tags", "SELECT count(*) FROM legacy.agents a,json_each(a.tags)"),
        ("channel_members", "SELECT count(*) FROM legacy.channel_members"),
        ("message_attachments", "SELECT count(*) FROM legacy.messages m,json_each(m.attachments)"),
        (
            "message_mentions",
            "SELECT count(*) FROM legacy.messages m,json_each(m.mentions) j WHERE j.value NOT IN ('me','system')",
        ),
        (
            "notification_receipts",
            "SELECT count(*) FROM legacy.meta WHERE substr(key,1,21)='desktop-notification:' AND length(key)>21",
        ),
        ("interrupted_jobs", "SELECT count(*) FROM legacy.meta m,json_each(m.value) WHERE m.key='interrupted_jobs'"),
        ("guild_profile", "SELECT count(*) FROM legacy.meta WHERE key='guild_profile'"),
    ] {
        let equal: bool =
            db.query_row(&format!("SELECT (SELECT count(*) FROM main.{new})=({old})"), [], |r| r.get(0))?;
        if !equal {
            return Err(fail(format!("Converted row count mismatch: {new}")));
        }
    }
    Ok(())
}
