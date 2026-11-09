//! システム時計（Clock の実装）。返すミリ秒はプロセス内で必ず増え、表示はローカル時刻。

use std::sync::atomic::{AtomicI64, Ordering};

use chrono::{Datelike, Local, TimeZone, Utc};
use guild_application::ports::Clock;

const WEEKDAYS: [&str; 7] = ["月", "火", "水", "木", "金", "土", "日"];

#[derive(Debug, Default)]
pub struct SystemClock {
    last_ms: AtomicI64,
}

impl SystemClock {
    pub fn new() -> Self {
        Self::default()
    }
}

impl Clock for SystemClock {
    fn now_ms(&self) -> i64 {
        let now = Utc::now().timestamp_millis();
        let (Ok(previous) | Err(previous)) =
            self.last_ms.fetch_update(Ordering::SeqCst, Ordering::SeqCst, |last| Some(now.max(last + 1)));
        now.max(previous + 1)
    }

    /// 例: "2026年11月8日(日) 15:30"
    fn local_label(&self, ms: i64) -> String {
        let Some(time) = Local.timestamp_millis_opt(ms).single() else {
            return String::new();
        };
        let weekday = WEEKDAYS.get(time.weekday().num_days_from_monday() as usize).copied().unwrap_or_default();
        format!("{}({weekday}) {}", time.format("%Y年%-m月%-d日"), time.format("%H:%M"))
    }
}
