//! 通知設定と永続的な送信試行記録。OSへの再送は行わず、会話の成否から切り離す。
use crate::error::AppResult;
use crate::ports::{DesktopNotifier, GuildStateRepository, SettingsStore};
use parking_lot::Mutex;
use std::sync::Arc;

pub struct NotificationService {
    settings: Arc<dyn SettingsStore>,
    receipts: Arc<dyn GuildStateRepository>,
    notifier: Arc<dyn DesktopNotifier>,
    gate: Mutex<()>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum NotificationOutcome {
    Submitted,
    Disabled,
    Duplicate,
}

impl NotificationService {
    pub fn new(
        settings: Arc<dyn SettingsStore>,
        receipts: Arc<dyn GuildStateRepository>,
        notifier: Arc<dyn DesktopNotifier>,
    ) -> Self {
        Self { settings, receipts, notifier, gate: Mutex::new(()) }
    }
    pub fn enabled(&self) -> AppResult<bool> {
        Ok(self.settings.load()?.desktop_notifications.unwrap_or(true))
    }
    pub fn set_enabled(&self, enabled: bool) -> AppResult<()> {
        let _guard = self.gate.lock();
        let mut settings = self.settings.load()?;
        settings.desktop_notifications = Some(enabled);
        self.settings.save(&settings)
    }
    /// 送信より先に記録する。クラッシュやOSの成否不明でも同じ発言の通知は再送しない。
    pub fn submit_once(&self, message_id: &str, title: &str, body: &str) -> AppResult<NotificationOutcome> {
        let _guard = self.gate.lock();
        if !self.receipts.claim_notification(message_id)? {
            return Ok(NotificationOutcome::Duplicate);
        }
        if !self.enabled()? {
            return Ok(NotificationOutcome::Disabled);
        }
        self.notifier.submit(title, body)?;
        Ok(NotificationOutcome::Submitted)
    }
}
