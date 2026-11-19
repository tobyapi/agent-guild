use super::{
    fixture::{old, populate, Fixture},
    Database,
};
use crate::infrastructure::sqlite::{SqliteAgentRepository, SqliteGuildStateRepository};
use guild_application::ports::{AgentRepository, GuildStateRepository};
use guild_domain::agent::role_permissions;
use std::{fs, sync::Arc};

#[test]
fn optional_records_and_files_round_trip_through_the_app_reader() {
    let f = Fixture::new();
    let db = old(&f.db(), 7);
    populate(&db);
    db.execute_batch(r#"
      INSERT INTO profile (id,name,avatar,color,frame) VALUES(1,'User','fox','red','custom:svg');
      INSERT INTO avatar_frames (id,name,svg,kind,created_at) VALUES
        ('custom:svg','Old frame','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><circle r="6"/></svg>','svg',20),
        ('custom:png','New frame','','png',21);
      INSERT INTO skill_record_cutoffs VALUES('cut','c');
      UPDATE messages SET attachments='[{"id":"photo","name":"note.txt","mediaType":"text/plain","size":4}]' WHERE id='m';
      UPDATE agents SET frame='custom:png';
    "#).unwrap();
    drop(db);
    fs::create_dir_all(f.0.join("attachments/c")).unwrap();
    fs::write(f.0.join("attachments/c/photo.txt"), b"note").unwrap();
    fs::create_dir(f.0.join("frames")).unwrap();
    let png = f.0.join("frames/custom_png.png");
    image::RgbaImage::new(2, 2).save(&png).unwrap();
    let file = fs::read(&png).unwrap();
    let db = Arc::new(Database::open(&f.db()).unwrap());
    let state = SqliteGuildStateRepository::new(db.clone());
    assert!(state.seeded().unwrap());
    assert!(!state.claim_notification("r").unwrap());
    assert_eq!(state.guild().unwrap().name, "Guild");
    assert_eq!(state.interrupted_jobs().unwrap().len(), 1);
    let agents = SqliteAgentRepository::new(db.clone()).list().unwrap();
    assert_eq!(agents[0].tags, ["作業者", "z"]);
    assert_eq!(agents[0].permissions, role_permissions(&agents[0].tags));
    db.with(|c| {
        for test in [
            "SELECT frame_id='custom:svg' FROM user_profile",
            "SELECT svg_text IS NULL FROM avatar_frames WHERE kind='png'",
            "SELECT svg_text LIKE '%<circle r=\"6\"/>%' FROM avatar_frames WHERE kind='svg'",
            "SELECT attachment_id='photo' AND position=0 AND size_bytes=4 FROM message_attachments",
            "SELECT channel_id='c' AND job_id='cut' FROM skill_record_cutoffs",
            "SELECT count(*)=2 FROM messages",
        ] {
            assert!(c.query_row(test, [], |r| r.get::<_, bool>(0))?, "{test}");
        }
        Ok(())
    })
    .unwrap();
    assert_eq!(fs::read(png).unwrap(), file);
    assert_eq!(fs::read(f.0.join("attachments/c/photo.txt")).unwrap(), b"note");
}
