//! Convert a classified v0.1.28 database while the data-directory lock is held.
mod adjustments;
mod backup;
mod guild_profile;
mod identity;
mod source;
mod svg;
#[cfg(test)]
mod tests;
mod validate;

use super::{schema, OpenError};
use guild_domain::voice::{normalize_voice, VoiceSettings};
use identity::{classify, Generation};
use rusqlite::{functions::FunctionFlags, Connection, OpenFlags, TransactionBehavior};
use std::{
    error::Error,
    fmt::Display,
    path::{Path, PathBuf},
    time::Duration,
};

type Result<T> = std::result::Result<T, Box<dyn Error>>;
fn fail(reason: impl Into<String>) -> Box<dyn Error> {
    reason.into().into()
}
fn corrupt(reason: impl Display) -> OpenError {
    OpenError::Corrupt(reason.to_string())
}

fn conversion(reason: impl Display, backup: Option<PathBuf>) -> OpenError {
    OpenError::Conversion { reason: reason.to_string(), backup }
}

pub(super) fn inspect(path: &Path) -> std::result::Result<(), OpenError> {
    checked_snapshot(path).map(|_| ())
}

fn checked_snapshot(path: &Path) -> std::result::Result<(source::Snapshot, Generation), OpenError> {
    let snapshot = source::Snapshot::open(path).map_err(corrupt)?;
    let generation = classify(&snapshot.db)?;
    backup::integrity(&snapshot.db).map_err(corrupt)?;
    if matches!(generation, Generation::Legacy) {
        validate::legacy(&snapshot.db).map_err(|error| conversion(error, None))?;
    }
    Ok((snapshot, generation))
}

pub(super) fn prepare(path: &Path) -> std::result::Result<(), OpenError> {
    let (snapshot, generation) = checked_snapshot(path)?;
    if matches!(generation, Generation::Current) {
        return Ok(());
    }
    let root = path.parent().ok_or_else(|| corrupt("Missing data directory"))?;
    let backup = backup::create(&snapshot.db, path).map_err(|error| conversion(error, None))?;
    #[cfg(unix)]
    backup::sync_published(&backup).map_err(|error| conversion(error, Some(backup.clone())))?;
    drop(snapshot);
    #[cfg(test)]
    fault("after-backup");
    convert(path, &backup, root).map_err(|error| conversion(error, Some(backup)))
}

fn convert(path: &Path, backup: &Path, root: &Path) -> Result<()> {
    let mut db = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_URI)?;
    db.busy_timeout(Duration::from_secs(5))?;
    db.execute_batch("PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA trusted_schema=OFF;")?;
    db.execute("ATTACH DATABASE ?1 AS legacy", [source::uri(backup)?])?;
    db.create_scalar_function("legacy_voice_mode", 1, FunctionFlags::SQLITE_DETERMINISTIC, |ctx| {
        let mode = ctx.get::<Option<String>>(0)?.unwrap_or_else(|| "auto".to_owned());
        Ok(normalize_voice(VoiceSettings { mode, ..VoiceSettings::default() }).ok().map(|voice| voice.mode))
    })?;
    let tx = db.transaction_with_behavior(TransactionBehavior::Immediate)?;
    if !matches!(classify(&tx)?, Generation::Legacy) {
        return Err(fail("Expected v0.1.28 database"));
    }
    backup::compare(&tx, "legacy")?;
    validate::legacy(&tx)?;
    adjustments::stage(&tx, root)?;
    tx.execute_batch(
        "DROP TABLE subtasks; DROP TABLE delegations; DROP TABLE messages;
       DROP TABLE channel_members; DROP TABLE run_measurements; DROP TABLE skill_record_cutoffs;
       DROP TABLE skills; DROP TABLE profile; DROP TABLE avatar_frames; DROP TABLE agents;
       DROP TABLE channels; DROP TABLE meta;",
    )?;
    schema::create(&tx)?;
    tx.execute_batch(include_str!("copy.sql"))?;
    validate::converted(&tx)?;
    backup::integrity(&tx)?;
    if !matches!(classify(&tx)?, Generation::Current) {
        return Err(fail("Converted schema mismatch"));
    }
    #[cfg(test)]
    fault("before-commit");
    tx.commit()?;
    #[cfg(test)]
    fault("after-commit");
    Ok(())
}

#[cfg(test)]
fn fault(point: &str) {
    if std::env::var("GUILD_DB_TEST_FAULT").as_deref() == Ok(point) {
        std::process::exit(87);
    }
}
