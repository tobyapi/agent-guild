use crate::infrastructure::{data_dir::write_marker, sqlite::schema::APPLICATION_ID};
use rusqlite::Connection;
use std::{
    fs,
    path::{Path, PathBuf},
};
pub(super) struct Fixture(pub PathBuf);
impl Fixture {
    pub fn new() -> Self {
        let root = std::env::temp_dir().join(format!("guild-conversion-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        write_marker(&root).unwrap();
        Self(root)
    }
    pub fn db(&self) -> PathBuf {
        self.0.join("guild.db")
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.0).unwrap();
    }
}
pub(super) fn old(path: &Path, version: usize) -> Connection {
    let db = Connection::open(path).unwrap();
    db.execute_batch("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)").unwrap();
    let mut hash = 0xcbf2_9ce4_8422_2325u64;
    let migrations = [
        include_str!("../migrations/0001_init.sql"),
        include_str!("../migrations/0002_channel_icon.sql"),
        include_str!("../migrations/0003_avatar_frames.sql"),
        include_str!("../migrations/0004_frame_images.sql"),
        include_str!("../migrations/0005_conversation_voice.sql"),
        include_str!("../migrations/0006_message_skill_usage.sql"),
        include_str!("../migrations/0007_skill_record_cutoffs.sql"),
    ];
    let applied: u32 = db.pragma_query_value(None, "user_version", |r| r.get(0)).unwrap();
    for (index, ddl) in migrations.iter().take(version).enumerate() {
        if index >= applied as usize {
            db.execute_batch(ddl).unwrap();
        }
        for b in ddl.replace("\r\n", "\n").bytes().chain(Some(0)) {
            hash = (hash ^ u64::from(b)).wrapping_mul(0x0100_0000_01b3);
        }
    }
    db.pragma_update(None, "application_id", APPLICATION_ID).unwrap();
    db.pragma_update(None, "user_version", version as i64).unwrap();
    db.execute("INSERT OR REPLACE INTO meta VALUES ('schema_fingerprint',?)", [format!("{hash:016x}")]).unwrap();
    db
}
pub(super) fn populate(db: &Connection) {
    db.execute_batch(r#"INSERT INTO meta VALUES('seeded','1');
      INSERT INTO meta VALUES('guild_profile','{"name":"Guild","crest":{"shape":"shield","color":"jade"}}');
      INSERT INTO channels(id,name,icon,topic,is_lobby,created_at,workspace_json)
        VALUES('c','Room','','',1,5,'{"mode":"folder","folder":"/old","revision":2,"afterSeq":14}');
      INSERT INTO channel_members VALUES ('c','me');
      INSERT INTO agents(id,name,name_key,avatar,color,tags,role,personality,tone,expertise,backend,model,backend_options,
          permissions,unmentioned,consultable,can_delegate,autonomy_enabled,autonomy_interval_min,created_at,voice)
      VALUES('a','A','a','x','y','["作業者","z"]','write','','','','codex','m','{}','{}','answer',1,0,0,60,0,'{"mode":"通常","intensity":"strong"}');
      INSERT INTO channel_members VALUES ('c','a');
      INSERT INTO messages(seq,id,channel_id,author_id,content,attachments,kind,mentions,root_id,depth,created_at,skill_usage)
      VALUES(14,'m','c','me','one','[]','chat','["a"]','m',0,12,'null');
      INSERT INTO messages(seq,id,channel_id,author_id,content,attachments,kind,mentions,reply_to_id,root_id,depth,created_at,delegation_id,skill_usage)
      VALUES(15,'r','c','a','two','[]','chat','[]','m','m',1,13,'d','{"declared":[],"loaded":[],"supported":true,"runId":null}');
      INSERT INTO delegations VALUES('d','c','a','r','done','r',1,2);
      INSERT INTO subtasks VALUES('s','d',0,'a','do','done','r',NULL);
      INSERT INTO meta VALUES('desktop-notification:r','attempted');
      INSERT INTO meta VALUES('interrupted_jobs','[{"agentId":"a","channelId":"c","depth":1,"rootId":"m"}]');
      UPDATE sqlite_sequence SET seq=101 WHERE name='messages';"#).unwrap();
}
