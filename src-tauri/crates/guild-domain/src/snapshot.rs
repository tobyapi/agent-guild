//! 画面の初期表示と state-changed のたびに React が取り直す全体像。

use serde::{Deserialize, Serialize};

use super::activity::ActivityState;
use super::agent::{Agent, AgentTemplate};
use super::backend::{BackendInfo, RuntimeStatus};
use super::channel::Channel;
use super::profile::Profile;

/// TS の Snapshot
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub me: Profile,
    /// 削除済み（deletedAt あり）も含む
    pub agents: Vec<Agent>,
    pub channels: Vec<Channel>,
    /// ランナーが ready でなければ空
    pub backends: Vec<BackendInfo>,
    /// エージェント作成のテンプレート
    pub templates: Vec<AgentTemplate>,
    pub runtime: RuntimeStatus,
    pub activity: ActivityState,
}
