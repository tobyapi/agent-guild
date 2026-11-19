use crate::infrastructure::sqlite::{schema, OpenError};
use rusqlite::Connection;
const FROZEN: [&str; 7] = [
    "b9ebe7d784f86fd1",
    "e90b30a50a9e4abc",
    "ce03e20d1d737e55",
    "201414d358f138da",
    "477db875bafd7dfb",
    "38d0abd74e58bd41",
    "14512365f8e91d16",
];
const OLD_STRUCTURE: u64 = 0x1098ca4437397d6b;
pub(super) enum Generation {
    Current,
    Legacy,
}
pub(super) fn classify(conn: &Connection) -> Result<Generation, OpenError> {
    let header = |name: &str| conn.pragma_query_value(None, name, |r| r.get::<_, i64>(0)).map_err(super::corrupt);
    if header("application_id")? != i64::from(schema::APPLICATION_ID) {
        return Err(OpenError::Foreign);
    }
    let v = header("user_version")?;
    if v > schema::VERSION {
        return Err(OpenError::Newer(v as usize));
    }
    if v == schema::VERSION {
        if schema::structure(conn).map_err(super::corrupt)? == schema::STRUCTURE {
            return Ok(Generation::Current);
        }
    } else if (1..=7).contains(&v) {
        let value: String = conn
            .query_row("SELECT value FROM meta WHERE key='schema_fingerprint'", [], |r| r.get(0))
            .map_err(super::corrupt)?;
        if value == FROZEN[(v - 1) as usize] {
            if v < 7 {
                return Err(OpenError::Needs028);
            }
            if schema::structure(conn).map_err(super::corrupt)? == OLD_STRUCTURE {
                return Ok(Generation::Legacy);
            }
        }
    }
    Err(super::corrupt(super::super::database::messages::fingerprint_mismatch()))
}
