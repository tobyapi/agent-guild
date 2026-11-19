use super::{fail, svg, Result};
use crate::infrastructure::{attachments::FsAttachments, frame_images::FsFrameImages};
use guild_application::ports::{AttachmentStore, FrameImageStore};
use guild_domain::{attachment::Attachment, ids::ChannelId, skill_usage::SkillUsage};
use rusqlite::{Connection, OptionalExtension};
use std::{fs, path::Path};

/// Reject legacy values which would otherwise be silently discarded by projecting JSON or by reversing a relation.
pub(super) fn legacy(db: &Connection, root: &Path) -> Result<()> {
    let issue = db
        .query_row(include_str!("preflight.sql"), [], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?))
        })
        .optional()?;
    if let Some((table, id)) = issue {
        return Err(fail(format!("{table}: {}", id.as_deref().unwrap_or("NULL"))));
    }
    if let Some(raw) = db
        .query_row("SELECT value FROM meta WHERE key='guild_profile'", [], |row| row.get::<_, String>(0))
        .optional()?
    {
        use guild_domain::guild::{normalize_guild, GuildProfile};
        let profile: GuildProfile = serde_json::from_str(&raw).map_err(|e| fail(format!("meta.guild_profile: {e}")))?;
        let normalized = normalize_guild(profile.clone()).map_err(|e| fail(format!("meta.guild_profile: {e}")))?;
        if normalized != profile {
            return Err(fail("meta.guild_profile: invalid stored name"));
        }
    }
    check_messages(db, root)?;
    check_frames(db, root)
}

fn check_messages(db: &Connection, root: &Path) -> Result<()> {
    let store = FsAttachments::new(root);
    let mut st = db.prepare(
        "SELECT id,channel_id,attachments,skill_usage FROM messages WHERE attachments<>'[]' OR skill_usage IS NOT NULL",
    )?;
    let mut rows = st.query([])?;
    while let Some(row) = rows.next()? {
        let id: String = row.get(0)?;
        let channel = ChannelId::new(row.get::<_, String>(1)?);
        let items: Vec<Attachment> = serde_json::from_str(&row.get::<_, String>(2)?)
            .map_err(|e| fail(format!("messages.attachments {id}: {e}")))?;
        for a in items {
            if fs::metadata(store.path(&channel, &a)).map_err(|e| fail(format!("attachments {id}: {e}")))?.len()
                != a.size
            {
                return Err(fail(format!("attachments: {id}")));
            }
        }
        if let Some(raw) = row.get::<_, Option<String>>(3)? {
            serde_json::from_str::<Option<SkillUsage>>(&raw)
                .map_err(|e| fail(format!("messages.skill_usage {id}: {e}")))?;
        }
    }
    Ok(())
}

fn check_frames(db: &Connection, root: &Path) -> Result<()> {
    let store = FsFrameImages::new(root);
    let mut st = db.prepare("SELECT id,kind,svg FROM avatar_frames")?;
    let mut rows = st.query([])?;
    while let Some(row) = rows.next()? {
        let id: String = row.get(0)?;
        match row.get::<_, String>(1)?.as_str() {
            "svg" => {
                let raw: String = row.get(2)?;
                let safe =
                    svg::sanitize_frame_svg(&raw).map_err(|e| fail(format!("avatar_frames {id}: {}", e.message())))?;
                if safe != raw {
                    return Err(fail(format!("avatar_frames {id}: noncanonical SVG")));
                }
            }
            "png" => {
                let bytes = store.read(&id)?;
                image::load_from_memory_with_format(&bytes, image::ImageFormat::Png)
                    .map_err(|e| fail(format!("avatar_frames {id}: {e}")))?;
            }
            _ => return Err(fail(format!("avatar_frames {id}: unknown kind"))),
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
        ("avatar_frames", "avatar_frames", "id"),
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
        ("message_mentions", "SELECT count(*) FROM legacy.messages m,json_each(m.mentions)"),
        ("notification_receipts", "SELECT count(*) FROM legacy.meta WHERE substr(key,1,21)='desktop-notification:'"),
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
