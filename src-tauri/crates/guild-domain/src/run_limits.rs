//! 会話ジョブに適用する全体設定。
use serde::{Deserialize, Serialize};

use crate::{error::ValidationError, locale};

pub const RUN_TIMEOUT_MINUTES: [u16; 3] = [30, 60, 120];
pub const MAX_CONCURRENT_JOBS: u8 = 10;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunLimits {
    pub timeout_minutes: Option<u16>,
    pub max_concurrent_jobs: Option<u8>,
}

impl RunLimits {
    pub fn validate(self) -> Result<(), ValidationError> {
        if self.timeout_minutes.is_some_and(|minutes| !RUN_TIMEOUT_MINUTES.contains(&minutes)) {
            return Err(ValidationError::on(
                "timeoutMinutes",
                locale::pick([
                    "実行の上限時間は30分、60分、120分、制限なしのいずれかを選んでください。",
                    "Choose 30, 60, or 120 minutes, or no limit.",
                    "请选择 30、60、120 分钟或不限时。",
                    "請選擇 30、60、120 分鐘或不限時。",
                    "30분, 60분, 120분 또는 제한 없음을 선택하세요.",
                ]),
            ));
        }
        if self.max_concurrent_jobs.is_some_and(|max| !(1..=MAX_CONCURRENT_JOBS).contains(&max)) {
            return Err(ValidationError::on(
                "maxConcurrentJobs",
                locale::pick([
                    "同時実行数は1〜10件、または制限なしを選んでください。",
                    "Choose 1 to 10 concurrent runs or no limit.",
                    "请选择同时运行 1 至 10 项或不限数量。",
                    "請選擇同時執行 1 至 10 項或不限數量。",
                    "동시 실행은 1~10개 또는 제한 없음을 선택하세요.",
                ]),
            ));
        }
        Ok(())
    }
}
