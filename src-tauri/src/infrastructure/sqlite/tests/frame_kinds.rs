//! アイコンの枠の絵の種類: 0004 の移行で kind 列が足され、0003 までの DB の SVG の枠はそのまま開ける。
//! 知らない種類の行（新しい版が足したもの）は一覧に出さない。

use std::fs;
use std::sync::Arc;

use guild_application::ports::FrameRepository;
use guild_domain::frame::{CustomFrame, FrameArt};
use rusqlite::Connection;

use super::{memory, temp_dir};
use crate::infrastructure::sqlite::migrations::{self, APPLICATION_ID};
use crate::infrastructure::sqlite::{Database, SqliteFrameRepository};

const ROSE_SVG: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><circle r="3"/></svg>"#;

/// 0003 までを当てた（配布済みの版が作った）データベースに、生成した SVG の枠を1つ入れる
fn version_three_database(path: &std::path::Path) {
    let conn = Connection::open(path).unwrap();
    conn.pragma_update(None, "application_id", APPLICATION_ID).unwrap();
    conn.execute_batch("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)").unwrap();
    conn.execute_batch(include_str!("../migrations/0001_init.sql")).unwrap();
    conn.execute_batch(include_str!("../migrations/0002_channel_icon.sql")).unwrap();
    conn.execute_batch(include_str!("../migrations/0003_avatar_frames.sql")).unwrap();
    conn.pragma_update(None, "user_version", 3).unwrap();
    conn.execute("INSERT INTO meta (key, value) VALUES ('schema_fingerprint', ?1)", [migrations::fingerprint(3)])
        .unwrap();
    conn.execute(
        "INSERT INTO avatar_frames (id, name, svg, created_at) VALUES ('custom:old', '月夜の薔薇', ?1, 5)",
        [ROSE_SVG],
    )
    .unwrap();
}

#[test]
fn svg_frames_of_an_old_database_stay_svg_frames() {
    let dir = temp_dir("frame-kind-upgrade");
    let path = dir.join("guild.db");
    version_three_database(&path);
    let db = Arc::new(Database::open(&path).unwrap());
    let frames = SqliteFrameRepository::new(db.clone());
    let old = CustomFrame {
        id: "custom:old".to_owned(),
        name: "月夜の薔薇".to_owned(),
        art: FrameArt::Svg { svg: ROSE_SVG.to_owned() },
        created_at: 5,
    };
    assert_eq!(frames.list().unwrap(), vec![old.clone()]);
    let png = CustomFrame { id: "custom:new".to_owned(), name: "灯火".to_owned(), art: FrameArt::Png, created_at: 6 };
    frames.insert(&png).unwrap();
    drop((frames, db));
    assert_eq!(migrations::applied_version(&Connection::open(&path).unwrap()).unwrap(), 4);
    assert_eq!(migrations::latest_version(), 4);
    let reopened = SqliteFrameRepository::new(Arc::new(Database::open(&path).unwrap()));
    assert_eq!(reopened.list().unwrap(), vec![old, png.clone()]);
    assert_eq!(reopened.get("custom:new").unwrap(), Some(png));
    drop(reopened);
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn frames_of_an_unknown_kind_are_not_listed() {
    let db = memory();
    db.with(|conn| {
        conn.execute(
            "INSERT INTO avatar_frames (id, name, kind, svg, created_at) VALUES ('custom:x', '未来', 'webp', '', 1)",
            [],
        )
    })
    .unwrap();
    let frames = SqliteFrameRepository::new(db);
    assert!(frames.list().unwrap().is_empty());
    assert_eq!(frames.get("custom:x").unwrap(), None);
}
