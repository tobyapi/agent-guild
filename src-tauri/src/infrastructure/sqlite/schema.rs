use rusqlite::Connection;

pub(super) const APPLICATION_ID: i32 = 0x4755_494c;
pub(super) const VERSION: i64 = 8;
pub(super) const DDL: &str = include_str!("schema-v1.sql");
pub(super) const STRUCTURE: u64 = 0xf959f1a4b64c56dd;
pub(super) fn create(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(DDL)?;
    conn.pragma_update(None, "application_id", APPLICATION_ID)?;
    conn.pragma_update(None, "user_version", VERSION)
}

fn hash_text(hash: &mut u64, text: &str) {
    for b in text.replace("\r\n", "\n").bytes().chain(std::iter::once(0)) {
        *hash = (*hash ^ u64::from(b)).wrapping_mul(0x0100_0000_01b3);
    }
}

pub(super) fn structure(conn: &Connection) -> rusqlite::Result<u64> {
    let mut rows = conn.prepare(
        "SELECT type,name,sql FROM main.sqlite_schema WHERE substr(name,1,7) <> 'sqlite_' ORDER BY type,name",
    )?;
    let mut rows = rows.query([])?;
    let mut hash = 0xcbf2_9ce4_8422_2325;
    while let Some(row) = rows.next()? {
        for i in 0..3 {
            hash_text(&mut hash, &row.get::<_, String>(i)?);
        }
    }
    Ok(hash)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn v1_schema_matches_its_frozen_definition() {
        let mut digest = 0xcbf2_9ce4_8422_2325;
        hash_text(&mut digest, DDL);
        assert_eq!(digest, 0x301aeaffe671f77a);
        let c = Connection::open_in_memory().unwrap();
        create(&c).unwrap();
        assert_eq!(structure(&c).unwrap(), STRUCTURE);
    }
}
