//! 言語の変更（docs/i18n.md）: settings.json に保存し、いまの言語にして、ランナーへ伝える。
//! プロセスのいまの言語（locale::set_current）は並行するテストに響くので、変え方を差し替えて確かめる。

use std::sync::Arc;

use guild_application::language::LanguageService;
use guild_application::ports::{LaunchSettings, SettingsStore};
use guild_application::{AppError, AppResult};
use guild_domain::locale::Language;
use parking_lot::Mutex;

use crate::support::TestApp;

static APPLIED: Mutex<Vec<Language>> = Mutex::new(Vec::new());

fn remember(language: Language) {
    APPLIED.lock().push(language);
}

/// 新しい版のアプリの設定ファイル（書き換えない）
struct NewerSettings;

impl SettingsStore for NewerSettings {
    fn load(&self) -> AppResult<LaunchSettings> {
        Ok(LaunchSettings::default())
    }
    fn save(&self, _settings: &LaunchSettings) -> AppResult<()> {
        Err(AppError::Storage("新しい版".to_owned()))
    }
}

#[tokio::test]
async fn the_language_is_saved_applied_and_sent_to_the_runner() {
    let app = TestApp::new();
    let library = LaunchSettings { setup_done: true, ..LaunchSettings::default() };
    app.settings.save(&library).unwrap();
    let service = LanguageService::new(app.settings.clone(), Some(app.runtime.clone())).with_apply(remember);
    service.set(Language::Ko).await.unwrap();
    let saved = app.settings.saved.lock().last().cloned().unwrap();
    assert_eq!(saved, LaunchSettings { language: Some(Language::Ko), ..library }, "ほかの項目はそのまま");
    assert_eq!(service.saved().unwrap(), Some(Language::Ko));
    assert!(APPLIED.lock().contains(&Language::Ko));
    assert_eq!(*app.runtime.languages.lock(), vec![Language::Ko]);
}

#[tokio::test]
async fn a_newer_settings_file_is_left_alone_and_nothing_changes() {
    let app = TestApp::new();
    let service = LanguageService::new(Arc::new(NewerSettings), Some(app.runtime.clone())).with_apply(remember);
    let result = service.set(Language::ZhHant).await;
    assert!(matches!(result, Err(AppError::Storage(_))));
    assert!(!APPLIED.lock().contains(&Language::ZhHant));
    assert!(app.runtime.languages.lock().is_empty());
}

#[tokio::test]
async fn in_recovery_mode_only_the_settings_and_the_current_language_change() {
    let app = TestApp::new();
    let service = LanguageService::new(app.settings.clone(), None).with_apply(remember);
    service.set(Language::ZhHans).await.unwrap();
    assert_eq!(app.settings.load().unwrap().language, Some(Language::ZhHans));
    assert!(APPLIED.lock().contains(&Language::ZhHans));
}
