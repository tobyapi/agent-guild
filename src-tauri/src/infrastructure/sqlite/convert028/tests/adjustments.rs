use super::{
    fixture::{old, populate, Fixture},
    source, Command,
};
use std::fs;
use std::process::Output;

#[test]
fn guild_profiles_keep_the_values_displayed_by_028() {
    let long_name = "界".repeat(33);
    let cases = [
        (r#"{"crest":{"shape":"shield"}}"#, "", "shield", "default"),
        (r#"{"name":"　灯の団  ","crest":{"shape":"circle","color":"jade"}}"#, "灯の団", "circle", "jade"),
        (&format!(r#"{{"name":"{long_name}","crest":{{"shape":"star","color":"azure"}}}}"#), "", "star", "azure"),
        ("{invalid", "", "diamond", "default"),
    ];
    for (raw, name, shape, color) in cases {
        let f = Fixture::new();
        old(&f.db(), 7).execute("INSERT INTO meta VALUES ('guild_profile', ?)", [raw]).unwrap();
        super::inspect(&f.db()).unwrap();
        super::prepare(&f.db()).unwrap();
        let db = source::read_only(&f.db()).unwrap();
        let actual: (String, String, String) = db
            .query_row("SELECT name,crest_shape,crest_color FROM guild_profile", [], |r| {
                Ok((r.get(0)?, r.get(1)?, r.get(2)?))
            })
            .unwrap();
        assert_eq!(actual, (name.to_owned(), shape.to_owned(), color.to_owned()));
    }
}

#[test]
fn converts_optional_damage_and_logs_counts_and_ids_without_logging_values() {
    let f = Fixture::new();
    populate_damaged_records(&f);
    let out = open_in_child(&f, None);
    let log = String::from_utf8(out.stderr).unwrap();
    assert!(out.status.success(), "{log}");
    for warning in [
        r#"attachment_unavailable count=1 ids=["m/lost"]"#,
        r#"attachment_size_mismatch count=1 ids=["m/short"]"#,
        r#"png_unreadable count=1 ids=["custom:png"]"#,
        r#"reserved_mention count=3 ids=["m/me", "m/me", "m/system"]"#,
        r#"unknown_meta count=1 ids=["unexpected"]"#,
        r#"svg_normalized count=1 ids=["custom:ok"]"#,
        r#"svg_reset count=1 ids=["custom:bad"]"#,
        r#"agent_frame_reset count=1 ids=["a"]"#,
        r#"voice_mode_defaulted count=1 ids=["a"]"#,
        r#"voice_intensity_defaulted count=1 ids=["a"]"#,
        r#"crest_shape_defaulted count=1 ids=["guild_profile"]"#,
        r#"crest_color_defaulted count=1 ids=["guild_profile"]"#,
        r#"profile_frame_reset count=1 ids=["1"]"#,
        r#"receipt_normalized count=1 ids=["old"]"#,
    ] {
        assert_eq!(log.matches(warning).count(), 1, "{warning}: {log}");
    }
    assert!(!log.contains("private-value"));
    let db = source::read_only(&f.db()).unwrap();
    for sql in [
        "SELECT count(*)=2 FROM messages",
        "SELECT count(*)=1 AND min(position)=0 AND min(actor_id)='a' FROM message_mentions",
        "SELECT count(*)=2 AND sum(size_bytes)=22 FROM message_attachments",
        "SELECT frame_id IS NULL AND voice_mode='auto' AND voice_intensity='weak' FROM agents",
        "SELECT name='Guild' AND crest_shape='diamond' AND crest_color='default' FROM guild_profile",
        "SELECT frame_id IS NULL FROM user_profile",
        "SELECT count(*)=2 FROM avatar_frames",
        "SELECT kind='png' AND svg_text IS NULL FROM avatar_frames WHERE id='custom:png'",
        r#"SELECT svg_text='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><circle r="6"/></svg>' FROM avatar_frames WHERE id='custom:ok'"#,
        "SELECT outcome='attempted' FROM notification_receipts WHERE message_id='old'",
    ] {
        assert!(db.query_row(sql, [], |r| r.get::<_, bool>(0)).unwrap(), "{sql}");
    }
    let backup = fs::read_dir(f.0.join("backups/pre-1.0.0")).unwrap().next().unwrap().unwrap().path();
    let original = source::read_only(&backup.join("guild.db")).unwrap();
    let untouched: bool =
        original.query_row("SELECT value='private-value' FROM meta WHERE key='unexpected'", [], |r| r.get(0)).unwrap();
    assert!(untouched);
}

#[test]
fn rolled_back_adjustments_are_logged_only_on_successful_retry() {
    let f = Fixture::new();
    old(&f.db(), 7).execute("INSERT INTO meta VALUES ('guild_profile', ?)", ["{private-value"]).unwrap();
    let aborted = open_in_child(&f, Some("before-commit"));
    assert_eq!(aborted.status.code(), Some(87));
    assert!(!String::from_utf8(aborted.stderr).unwrap().contains("v0.1.28 conversion:"));

    let committed = open_in_child(&f, None);
    let log = String::from_utf8(committed.stderr).unwrap();
    assert!(committed.status.success(), "{log}");
    assert_eq!(log.matches(r#"guild_profile_defaulted count=1 ids=["guild_profile"]"#).count(), 1);
    assert!(!log.contains("private-value"));
}

fn open_in_child(f: &Fixture, fault: Option<&str>) -> Output {
    let mut cmd = Command::new(std::env::current_exe().unwrap());
    cmd.args(["--exact", "infrastructure::sqlite::convert028::tests::open_disposable_copy", "--nocapture"])
        .env("GUILD_DATA_DIR", &f.0)
        .env("GUILD_CONVERSION_TEST_CHILD", "1");
    if let Some(point) = fault {
        cmd.env("GUILD_DB_TEST_FAULT", point);
    }
    cmd.output().unwrap()
}

fn populate_damaged_records(f: &Fixture) {
    let db = old(&f.db(), 7);
    populate(&db);
    db.execute_batch(r#"
      INSERT INTO meta VALUES ('unexpected','private-value');
      INSERT INTO meta VALUES ('desktop-notification:old','unrecognized');
      UPDATE meta SET value='arbitrary-marker' WHERE key='seeded';
      UPDATE messages SET mentions='["me","a","system","me"]',
        attachments='[{"id":"lost","name":"p.txt","size":17,"mediaType":"text/plain"},{"id":"short","name":"s.txt","size":5,"mediaType":"text/plain"}]'
        WHERE id='m';
      INSERT INTO avatar_frames(id,name,kind,svg,created_at) VALUES
        ('custom:ok','Ok','svg','  <svg><circle r="6"/></svg>  ',0),
        ('custom:bad','Bad','svg','invalid',0), ('custom:png','Png','png','',0);
      UPDATE agents SET frame='custom:bad',voice='{"mode":"discarded","intensity":"retired"}';
      UPDATE meta SET value=json_set(value,'$.crest.shape','retired','$.crest.color','retired') WHERE key='guild_profile';
      INSERT INTO profile(id,name,avatar,color,frame) VALUES(1,'User','x','y','custom:bad');
    "#).unwrap();
    drop(db);
    fs::create_dir_all(f.0.join("attachments/c")).unwrap();
    fs::write(f.0.join("attachments/c/short.txt"), b"x").unwrap();
    fs::create_dir(f.0.join("frames")).unwrap();
    fs::write(f.0.join("frames/custom_png.png"), b"broken").unwrap();
}
