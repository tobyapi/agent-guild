//! 画面の初期表示と state-changed のたびに React が取り直す全体像。

use serde::{Deserialize, Serialize};

use super::activity::ActivityState;
use super::agent::{Agent, AgentTemplate};
use super::backend::{BackendInfo, RuntimeStatus};
use super::channel::Channel;
use super::frame::CustomFrame;
use super::guild::GuildProfile;
use super::profile::Profile;

/// TS の Snapshot
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    /// ギルドの名前と紋
    pub guild: GuildProfile,
    pub me: Profile,
    /// 削除済み（deletedAt あり）も含む
    pub agents: Vec<Agent>,
    pub channels: Vec<Channel>,
    /// ランナーが ready でなければ空
    pub backends: Vec<BackendInfo>,
    /// エージェント作成のテンプレート
    pub templates: Vec<AgentTemplate>,
    /// 生成したアイコンの枠（作成順。内蔵の枠は React が持つ）
    pub frames: Vec<CustomFrame>,
    pub runtime: RuntimeStatus,
    pub activity: ActivityState,
}
