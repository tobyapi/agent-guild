//! 保存先の変更（design.md §11）: 検証・copy・open・失敗時の復帰・復旧モード。

use std::path::PathBuf;
use std::sync::atomic::Ordering;

use guild_application::ports::{FolderState, LaunchSettings};
use guild_application::storage::StorageService;
use guild_application::{AppError, StoragePorts};
use guild_domain::storage::{DataDirMode, StorageSource};

use crate::support::TestApp;

const TARGET: &str = "D:\\GuildData";

fn answer(app: &TestApp, state: FolderState) {
    app.folders.answer.lock().state = state;
}

fn restarts(app: &TestApp) -> usize {
    app.control.restarts.load(Ordering::SeqCst)
}

#[tokio::test]
async fn copy_exports_writes_settings_and_restarts() {
    let app = TestApp::new();
    app.services.storage.change_data_dir(TARGET, DataDirMode::Copy).await.unwrap();
    assert_eq!(*app.exporter.exported.lock(), vec![PathBuf::from(TARGET)]);
    assert_eq!(*app.settings.saved.lock(), vec![LaunchSettings { data_dir: Some(PathBuf::from(TARGET)), ..LaunchSettings::default() }]);
    assert_eq!(restarts(&app), 1);
}

#[tokio::test]
async fn copy_refuses_folders_with_data() {
    let app = TestApp::new();
    answer(&app, FolderState::Guild);
    let result = app.services.storage.change_data_dir(TARGET, DataDirMode::Copy).await;
    assert!(matches!(result, Err(AppError::Conflict(_))));
    answer(&app, FolderState::Foreign);
    let result = app.services.storage.change_data_dir(TARGET, DataDirMode::Copy).await;
    assert!(matches!(result, Err(AppError::Validation(_))));
    assert!(app.exporter.exported.lock().is_empty());
    assert_eq!(restarts(&app), 0);
}

#[tokio::test]
async fn a_failed_copy_leaves_maintenance_and_does_not_restart() {
    let app = TestApp::new();
    let lobby = app.channel("ロビー", &[]);
    app.exporter.fail.store(true, Ordering::SeqCst);
    let result = app.services.storage.change_data_dir(TARGET, DataDirMode::Copy).await;
    assert!(matches!(result, Err(AppError::Storage(_))));
    assert_eq!(restarts(&app), 0);
    assert!(app.services.conversation.send_human_message(&lobby.id, "送れる", &[]).is_ok(), "メンテナンスは解ける");
}

#[tokio::test]
async fn open_checks_the_folder_and_writes_null_for_the_default() {
    let app = TestApp::new();
    answer(&app, FolderState::IncompatibleGuild("新しい版のデータです".to_owned()));
    let result = app.services.storage.change_data_dir(TARGET, DataDirMode::Open).await;
    let error = result.expect_err("新しい版のデータは開かない").to_command_error();
    assert_eq!((error.message.as_str(), error.field.as_deref()), ("新しい版のデータです", Some("path")));
    answer(&app, FolderState::Foreign);
    assert!(app.services.storage.change_data_dir(TARGET, DataDirMode::Open).await.is_err());

    answer(&app, FolderState::Guild);
    app.folders.answer.lock().is_default = true;
    app.services.storage.change_data_dir(TARGET, DataDirMode::Open).await.unwrap();
    assert_eq!(*app.settings.saved.lock(), vec![LaunchSettings::default()]);
    assert!(app.exporter.exported.lock().is_empty(), "open はコピーしない");
    assert_eq!(restarts(&app), 1);
}

#[tokio::test]
async fn rejects_relative_current_and_nested_folders() {
    let app = TestApp::new();
    let storage = &app.services.storage;
    assert!(matches!(storage.change_data_dir("GuildData", DataDirMode::Open).await, Err(AppError::Validation(_))));
    app.folders.answer.lock().is_current = true;
    assert!(matches!(storage.change_data_dir(TARGET, DataDirMode::Open).await, Err(AppError::Validation(_))));
    app.folders.answer.lock().is_current = false;
    app.folders.answer.lock().is_nested = true;
    assert!(matches!(storage.change_data_dir(TARGET, DataDirMode::Open).await, Err(AppError::Validation(_))));
    assert_eq!(restarts(&app), 0);
}

#[tokio::test]
async fn a_data_dir_fixed_by_the_environment_cannot_change() {
    let app = TestApp::with_source(StorageSource::Env);
    let result = app.services.storage.change_data_dir(TARGET, DataDirMode::Open).await;
    assert!(matches!(result, Err(AppError::Validation(_))));
}

#[tokio::test]
async fn recovery_mode_can_open_but_not_copy() {
    let app = TestApp::new();
    let ports = StoragePorts {
        info: app.services.storage.info(),
        folders: app.folders.clone(),
        settings: app.settings.clone(),
        control: app.control.clone(),
    };
    let recovery = StorageService::new(ports, None);
    let result = recovery.change_data_dir(TARGET, DataDirMode::Copy).await;
    assert!(matches!(result, Err(AppError::Unavailable(_))));
    recovery.change_data_dir(TARGET, DataDirMode::Open).await.unwrap();
    assert_eq!(restarts(&app), 1);
}
