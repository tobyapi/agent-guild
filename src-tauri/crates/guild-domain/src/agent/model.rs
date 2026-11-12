//! エージェントのデータ（TS の Agent と AgentInput）。

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use super::{Permissions, UnmentionedPolicy};
use crate::ids::{AgentId, ChannelId};

/// 作成・更新で受け取る項目（TS の AgentInput）
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentInput {
    pub name: String,
    pub avatar: String,
    pub color: String,
    /// アイコンの枠の ID（空は枠なし。古いデータにはないので既定は空）
    #[serde(default)]
    pub frame: String,
    pub tags: Vec<String>,
    pub role: String,
    pub personality: String,
    pub tone: String,
    pub expertise: String,
    pub backend: String,
    pub model: String,
    pub backend_options: Map<String, Value>,
    pub permissions: Permissions,
    pub unmentioned: UnmentionedPolicy,
    pub consultable: bool,
    pub can_delegate: bool,
    pub autonomy_enabled: bool,
    pub autonomy_interval_min: u32,
    pub autonomy_channel_id: Option<ChannelId>,
}

/// エージェント（TS の Agent）
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Agent {
    pub id: AgentId,
    pub name: String,
    /// 絵文字、または data:image/... の画像
    pub avatar: String,
    pub color: String,
    /// アイコンの枠の ID（空は枠なし。`builtin:<名前>` か `custom:<ID>`。guild-domain の frame）
    #[serde(default)]
    pub frame: String,
    /// 先頭は固定権限を決める役割。残りは表示と絞り込み用の自由なタグ
    pub tags: Vec<String>,
    pub role: String,
    pub personality: String,
    pub tone: String,
    /// 得意分野（空でもよい）。相談相手の一覧やプロンプトに出る
    pub expertise: String,
    /// ランナーが申告したバックエンド ID（Rust では列挙しない）
    pub backend: String,
    /// 空文字ならバックエンドの既定モデル
    pub model: String,
    /// バックエンド固有の設定（キーと型は BackendInfo.options が定める）
    pub backend_options: Map<String, Value>,
    /// 役割から算出した権限。保存・Snapshot・実行時に能力と依存関係で絞り直す
    pub permissions: Permissions,
    pub unmentioned: UnmentionedPolicy,
    /// 他のエージェントにメンションされたら、チャンネル外からでも参加して答える
    pub consultable: bool,
    /// tasks ブロックでタスクを割り振れる（マネージャー。design.md §7.1）
    pub can_delegate: bool,
    pub autonomy_enabled: bool,
    pub autonomy_interval_min: u32,
    pub autonomy_channel_id: Option<ChannelId>,
    pub last_autonomous_at: Option<i64>,
    pub created_at: i64,
    /// 論理削除。Some なら削除済み（過去の発言の表示にだけ使う）
    pub deleted_at: Option<i64>,
}

impl Agent {
    pub fn new(id: AgentId, input: AgentInput, created_at: i64) -> Self {
        // 分割代入にしておくと、AgentInput に項目を足したときにここがコンパイルエラーで知らせてくれる
        let AgentInput {
            name,
            avatar,
            color,
            frame,
            tags,
            role,
            personality,
            tone,
            expertise,
            backend,
            model,
            backend_options,
            permissions,
            unmentioned,
            consultable,
            can_delegate,
            autonomy_enabled,
            autonomy_interval_min,
            autonomy_channel_id,
        } = input;
        Self {
            id,
            name,
            avatar,
            color,
            frame,
            tags,
            role,
            personality,
            tone,
            expertise,
            backend,
            model,
            backend_options,
            permissions,
            unmentioned,
            consultable,
            can_delegate,
            autonomy_enabled,
            autonomy_interval_min,
            autonomy_channel_id,
            last_autonomous_at: None,
            created_at,
            deleted_at: None,
        }
    }

    /// 編集できる項目を入力で置き換える（id・作成日時・最後の自発活動・削除状態は保つ）
    pub fn apply(&mut self, input: AgentInput) {
        let (last_autonomous_at, deleted_at) = (self.last_autonomous_at, self.deleted_at);
        *self = Self { last_autonomous_at, deleted_at, ..Self::new(self.id.clone(), input, self.created_at) };
    }

    /// 削除されていない
    pub fn is_active(&self) -> bool {
        self.deleted_at.is_none()
    }
}
