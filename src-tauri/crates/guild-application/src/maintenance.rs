//! メンテナンス状態（保存先の変更中）。この間は送信と自発活動を止める。

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use guild_domain::locale;

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
                locale::pick([
                    "保存先を変更しているため、いまは送信できません",
                    "Messages cannot be sent right now because the data location is being changed",
                    "正在更改数据存储位置，暂时无法发送",
                    "正在變更資料儲存位置，暫時無法傳送",
                    "데이터 저장 위치를 변경하는 중이므로 지금은 보낼 수 없습니다",
                ])
                .to_owned(),
            ))
        } else {
            Ok(())
        }
    }
}
