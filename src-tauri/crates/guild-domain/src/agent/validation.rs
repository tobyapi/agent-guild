//! エージェント入力の検証と正規化（design.md §2 の入力規則）。名前の重複は name.rs の ensure_unique_name。

use super::name::normalize_name;
use super::tags::normalize_tags;
use super::{role_permissions, AgentInput};
use crate::backend::{sanitize_backend_options, BackendInfo};
use crate::error::ValidationError;
use crate::frame::normalize_frame_id;
use crate::locale;

/// 自発活動の間隔（分）の下限
pub const AUTONOMY_INTERVAL_MIN: u32 = 5;
/// アバター（data URL を含む）の最大バイト数
pub const AVATAR_MAX_BYTES: usize = 2 * 1024 * 1024;

/// 入力を検証して正規化する。権限は役割（先頭タグ）だけで決め、バックエンドでは変えない。
/// backend は選んだバックエンドの情報（ランナーが未起動で分からなければ None。そのときは backendOptions を保つ）
pub fn normalize_agent_input(
    mut input: AgentInput,
    backend: Option<&BackendInfo>,
) -> Result<AgentInput, ValidationError> {
    input.name = normalize_name(&input.name)?;
    input.tags = normalize_tags(&input.tags)?;
    input.frame = normalize_frame_id(&input.frame)?;
    input.permissions = role_permissions(&input.tags);
    input.backend = input.backend.trim().to_owned();
    input.model = input.model.trim().to_owned();
    if input.backend.is_empty() {
        return Err(ValidationError::on(
            "backend",
            locale::pick([
                "バックエンドを選んでください",
                "Choose a backend",
                "请选择后端",
                "請選擇後端",
                "백엔드를 선택하십시오",
            ]),
        ));
    }
    if input.autonomy_interval_min < AUTONOMY_INTERVAL_MIN {
        return Err(ValidationError::on(
            "autonomyIntervalMin",
            locale::pick([
                "自発活動の間隔は5分以上にしてください",
                "The autonomous activity interval must be at least 5 minutes",
                "自主活动的间隔至少为 5 分钟",
                "自主活動的間隔至少為 5 分鐘",
                "자율 활동 간격은 5분 이상으로 설정하십시오",
            ]),
        ));
    }
    if input.avatar.len() > AVATAR_MAX_BYTES {
        return Err(ValidationError::on(
            "avatar",
            locale::pick([
                "アバター画像が大きすぎます（2MB まで）",
                "The avatar image is too large (up to 2 MB)",
                "头像图片过大（最大 2MB）",
                "頭像圖片過大（最大 2MB）",
                "아바타 이미지가 너무 큽니다(최대 2MB)",
            ]),
        ));
    }
    if let Some(info) = backend {
        input.backend_options = sanitize_backend_options(input.backend_options, info, &input.model)?;
        if info.tools_requested(&input.backend_options) && !info.tools_enabled(&input.backend_options, &input.model) {
            return Err(ValidationError::on(
                "permissions",
                locale::pick([
                    "道具に対応したモデルを選んでください",
                    "Choose a model that supports tools",
                    "请选择支持工具的模型",
                    "請選擇支援工具的模型",
                    "도구를 지원하는 모델을 선택하십시오",
                ]),
            ));
        }
    }
    Ok(input)
}
