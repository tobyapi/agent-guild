//! チャンネルのアイコン: 作成・更新で正規化して保存し、不正なら validation で何も変えない。

use guild_application::ports::ChannelRepository;
use guild_application::AppError;

use crate::support::TestApp;

#[tokio::test]
async fn channels_keep_a_normalized_icon_and_the_lobby_starts_without_one() {
    let app = TestApp::new();
    let lobby = app.services.channels.create_lobby("ロビー", "", &[]).unwrap();
    assert_eq!(lobby.icon, "");
    let channel = app.services.channels.create("設計", "", " 🎨 ", &[]).unwrap();
    assert_eq!(channel.icon, "🎨");
    let updated = app.services.channels.update(&channel.id, "設計", "", "＃").unwrap();
    assert_eq!(updated.icon, "");
    let saved = ChannelRepository::get(app.store.as_ref(), &channel.id).unwrap().unwrap();
    assert_eq!(saved.icon, "");
}

#[tokio::test]
async fn invalid_icons_are_rejected_without_changes() {
    let app = TestApp::new();
    let error = app.services.channels.create("設計", "", "ab", &[]).unwrap_err();
    assert!(matches!(error, AppError::Validation(ref e) if e.field() == Some("icon")), "{error:?}");
    let channel = app.services.channels.create("設計", "", "🧪", &[]).unwrap();
    assert!(app.services.channels.update(&channel.id, "設計", "", "🧪🎨").is_err());
    let saved = ChannelRepository::get(app.store.as_ref(), &channel.id).unwrap().unwrap();
    assert_eq!(saved.icon, "🧪");
}
