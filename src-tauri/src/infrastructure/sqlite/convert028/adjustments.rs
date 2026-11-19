//! Optional legacy artwork and advisory metadata. Only the new database receives repairs.
use super::{svg, Result};
use crate::infrastructure::{attachments::FsAttachments, frame_images::FsFrameImages};
use guild_application::ports::{AttachmentStore, FrameImageStore};
use guild_domain::{attachment::Attachment, ids::ChannelId};
use rusqlite::{params, Connection};
use std::{collections::BTreeMap, fs, path::Path};

#[derive(Default)]
struct Warnings(BTreeMap<String, Vec<String>>);

impl Warnings {
    fn add(&mut self, kind: &str, id: String) {
        self.0.entry(kind.to_owned()).or_default().push(id);
    }

    fn emit(self) {
        for (kind, ids) in self.0 {
            log::warn!("v0.1.28 conversion: {kind} count={} ids={ids:?}", ids.len());
        }
    }
}

pub(super) fn stage(db: &Connection, root: &Path) -> Result<()> {
    let mut warnings = Warnings::default();
    db.execute_batch("CREATE TEMP TABLE frame_repairs(id TEXT PRIMARY KEY, svg_text TEXT)")?;
    check_frames(db, root, &mut warnings)?;
    check_attachments(db, root, &mut warnings)?;
    let mut st = db.prepare(include_str!("warnings.sql"))?;
    let mut rows = st.query([])?;
    while let Some(row) = rows.next()? {
        warnings.add(&row.get::<_, String>(0)?, row.get(1)?);
    }
    warnings.emit();
    Ok(())
}

fn check_attachments(db: &Connection, root: &Path, warnings: &mut Warnings) -> Result<()> {
    let store = FsAttachments::new(root);
    let mut st = db.prepare("SELECT id,channel_id,attachments FROM messages WHERE attachments<>'[]'")?;
    let mut rows = st.query([])?;
    while let Some(row) = rows.next()? {
        let message: String = row.get(0)?;
        let channel = ChannelId::new(row.get::<_, String>(1)?);
        for item in serde_json::from_str::<Vec<Attachment>>(&row.get::<_, String>(2)?)? {
            let kind = match fs::metadata(store.path(&channel, &item)) {
                Ok(info) if info.is_file() && info.len() == item.size => continue,
                Ok(info) if info.is_file() => "attachment_size_mismatch",
                _ => "attachment_unavailable",
            };
            warnings.add(kind, format!("{message}/{}", item.id.as_str()));
        }
    }
    Ok(())
}

fn check_frames(db: &Connection, root: &Path, warnings: &mut Warnings) -> Result<()> {
    let store = FsFrameImages::new(root);
    let mut st = db.prepare("SELECT id,kind,svg FROM avatar_frames")?;
    let mut rows = st.query([])?;
    while let Some(row) = rows.next()? {
        let id: String = row.get(0)?;
        let (kind, repaired) = match row.get::<_, String>(1)?.as_str() {
            "svg" => {
                let raw: String = row.get(2)?;
                match svg::sanitize_frame_svg(&raw) {
                    Ok(safe) if safe == raw => continue,
                    Ok(safe) => ("svg_normalized", Some(safe)),
                    Err(_) => ("svg_reset", None),
                }
            }
            "png" => {
                let readable = store
                    .read(&id)
                    .is_ok_and(|bytes| image::load_from_memory_with_format(&bytes, image::ImageFormat::Png).is_ok());
                if !readable {
                    warnings.add("png_unreadable", id);
                }
                continue;
            }
            _ => ("unknown_frame_kind", None),
        };
        db.execute("INSERT INTO temp.frame_repairs VALUES (?,?)", params![id, repaired])?;
        warnings.add(kind, id);
    }
    Ok(())
}
