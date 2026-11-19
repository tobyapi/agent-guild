//! Preserve the field-by-field reading of guild profiles in v0.1.28.
use super::Result;
use guild_domain::guild::{normalize_guild, GuildCrest, GuildProfile};
use rusqlite::{params, Connection, OptionalExtension};
use serde::Deserialize;
use serde_json::Value;

pub(super) fn stage(db: &Connection) -> Result<()> {
    db.execute_batch("CREATE TEMP TABLE legacy_guild_profile(original_json TEXT, name TEXT, crest_json TEXT)")?;
    let raw: Option<String> =
        db.query_row("SELECT value FROM meta WHERE key='guild_profile'", [], |row| row.get(0)).optional()?;
    if let Some(raw) = raw {
        // The warnings query receives only JSON accepted by the old reader.
        let original = serde_json::from_str::<Value>(&raw).ok();
        let value = original.as_ref().unwrap_or(&Value::Null);
        let name = value["name"].as_str().unwrap_or_default().to_owned();
        let name = normalize_guild(GuildProfile { name, ..GuildProfile::default() })
            .map(|profile| profile.name)
            .unwrap_or_default();
        let crest = &value["crest"];
        let crest = GuildCrest {
            shape: Deserialize::deserialize(&crest["shape"]).unwrap_or_default(),
            color: Deserialize::deserialize(&crest["color"]).unwrap_or_default(),
        };
        db.execute(
            "INSERT INTO temp.legacy_guild_profile VALUES (?,?,?)",
            params![original.map(|v| v.to_string()), name, serde_json::to_string(&crest)?],
        )?;
    }
    Ok(())
}
