use super::TempDir;
use crate::infrastructure::{
    settings::SettingsFile,
    sqlite::{Database, SqliteGuildStateRepository},
};
use guild_application::{
    notifications::{NotificationOutcome, NotificationService},
    ports::DesktopNotifier,
    AppResult,
};
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};

#[derive(Default)]
struct Notifier(AtomicUsize);
impl DesktopNotifier for Notifier {
    fn submit(&self, _title: &str, _body: &str) -> AppResult<()> {
        self.0.fetch_add(1, Ordering::SeqCst);
        Ok(())
    }
}

#[test]
fn notification_receipt_survives_sqlite_reopen() {
    let dir = TempDir::new("notification-receipt");
    let database = dir.0.join("guild.sqlite");
    let notifier = Arc::new(Notifier::default());
    for attempt in 0..2 {
        let db = Arc::new(Database::open(&database).unwrap());
        let service = NotificationService::new(
            Arc::new(SettingsFile::in_dir(&dir.0)),
            Arc::new(SqliteGuildStateRepository::new(db)),
            notifier.clone(),
        );
        let result = service.submit_once("same-message", "Manager", "Done").unwrap();
        assert_eq!(result, if attempt == 0 { NotificationOutcome::Submitted } else { NotificationOutcome::Duplicate });
    }
    assert_eq!(notifier.0.load(Ordering::SeqCst), 1);
}

#[test]
fn disabled_notification_receipt_and_setting_survive_sqlite_reopen() {
    let dir = TempDir::new("notification-disabled-receipt");
    let database = dir.0.join("guild.sqlite");
    let notifier = Arc::new(Notifier::default());
    for attempt in 0..2 {
        let db = Arc::new(Database::open(&database).unwrap());
        let service = NotificationService::new(
            Arc::new(SettingsFile::in_dir(&dir.0)),
            Arc::new(SqliteGuildStateRepository::new(db)),
            notifier.clone(),
        );
        if attempt == 0 {
            assert!(service.enabled().unwrap());
            service.set_enabled(false).unwrap();
            assert_eq!(service.submit_once("disabled", "Manager", "Done").unwrap(), NotificationOutcome::Disabled);
        } else {
            assert!(!service.enabled().unwrap());
            service.set_enabled(true).unwrap();
            assert_eq!(service.submit_once("disabled", "Manager", "Done").unwrap(), NotificationOutcome::Duplicate);
        }
    }
    assert_eq!(notifier.0.load(Ordering::SeqCst), 0);
}
