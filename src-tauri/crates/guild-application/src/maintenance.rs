//! メンテナンス状態（保存先の変更中）。この間は送信と自発活動を止める。

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use crate::error::{AppError, AppResult};

#[derive(Debug, Clone, Default)]
pub struct Maintenance(Arc<AtomicBool>);

impl Maintenance {
    pub fn begin(&self) {
        self.0.store(true, Ordering::SeqCst);
    }

    pub fn end(&self) {
        self.0.store(false, Ordering::SeqCst);
    }

    pub fn is_active(&self) -> bool {
        self.0.load(Ordering::SeqCst)
    }

    /// メンテナンス中なら Unavailable
    pub fn ensure_available(&self) -> AppResult<()> {
        if self.is_active() {
            Err(AppError::Unavailable(
                "保存先を変更しているため、いまは送信できません".to_owned(),
            ))
        } else {
            Ok(())
        }
    }
}
