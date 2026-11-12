//! ギルドのプロフィール（名前と紋）の保存と、全体像への反映。

use std::sync::atomic::Ordering;

use guild_application::guild::GUILD_KEY;
use guild_application::ports::MetaRepository;
use guild_application::AppError;
use guild_domain::guild::{CrestColor, CrestShape, GuildCrest, GuildProfile};

use crate::support::TestApp;

fn lantern() -> GuildProfile {
    GuildProfile {
        name: " 灯の団 ".to_owned(),
        crest: GuildCrest { shape: CrestShape::Shield, color: CrestColor::Gold },
    }
}

#[tokio::test]
async fn a_new_guild_has_no_name_and_the_diamond_crest() {
    let app = TestApp::new();
    assert_eq!(app.services.guild.get().unwrap(), GuildProfile::default());
    assert_eq!(app.services.snapshot.get().unwrap().guild, GuildProfile::default());
}

#[tokio::test]
async fn updating_saves_the_trimmed_profile_and_announces_it() {
    let app = TestApp::new();
    let before = app.events.state_changes.load(Ordering::SeqCst);
    let saved = app.services.guild.update(lantern()).unwrap();
    assert_eq!(saved.name, "灯の団");
    assert_eq!(app.events.state_changes.load(Ordering::SeqCst), before + 1);
    assert_eq!(app.services.snapshot.get().unwrap().guild, saved);
    assert_eq!(app.restart().services.guild.get().unwrap(), saved, "データフォルダに残る");
}

#[tokio::test]
async fn invalid_names_are_rejected_without_saving() {
    let app = TestApp::new();
    let long = GuildProfile { name: "あ".repeat(33), ..lantern() };
    match app.services.guild.update(long) {
        Err(AppError::Validation(error)) => assert_eq!(error.field(), Some("name")),
        other => panic!("validation になるはず: {other:?}"),
    }
    assert_eq!(app.store.get(GUILD_KEY).unwrap(), None);
}

#[tokio::test]
async fn unreadable_saved_values_read_as_the_default() {
    let app = TestApp::new();
    app.store.set(GUILD_KEY, "{ 壊れた").unwrap();
    assert_eq!(app.services.snapshot.get().unwrap().guild, GuildProfile::default());
}
