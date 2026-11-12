//! 永続化のポート（実装は SQLite）。

use guild_domain::agent::Agent;
use guild_domain::author::MemberId;
use guild_domain::channel::Channel;
use guild_domain::delegation::Delegation;
use guild_domain::frame::CustomFrame;
use guild_domain::ids::{AgentId, ChannelId, DelegationId, MessageId, SkillId};
use guild_domain::message::{Message, MessageKind, NewMessage};
use guild_domain::profile::Profile;
use guild_domain::skill::Skill;
use guild_domain::statistics::{ChannelStatistics, RunMeasurement};

use crate::error::AppResult;

pub trait AgentRepository: Send + Sync {
    /// 削除済みを含む全エージェント（作成順）
    fn list(&self) -> AppResult<Vec<Agent>>;
    fn get(&self, id: &AgentId) -> AppResult<Option<Agent>>;
    /// 正規化した名前が削除されていない他のエージェントと重なれば Validation
    fn insert(&self, agent: &Agent) -> AppResult<()>;
    fn update(&self, agent: &Agent) -> AppResult<()>;
    /// 論理削除（deletedAt を入れる）
    fn mark_deleted(&self, id: &AgentId, deleted_at: i64) -> AppResult<()>;
}

pub trait ChannelRepository: Send + Sync {
    /// 作成順。メンバーは参加順
    fn list(&self) -> AppResult<Vec<Channel>>;
    fn get(&self, id: &ChannelId) -> AppResult<Option<Channel>>;
    fn insert(&self, channel: &Channel) -> AppResult<()>;
    /// 名前と話題を更新する
    fn update(&self, channel: &Channel) -> AppResult<()>;
    /// 作業範囲だけを保存する。名前・話題の同時更新で境界を巻き戻さない。
    fn set_workspace(&self, id: &ChannelId, scope: &guild_domain::channel::ChannelWorkspace) -> AppResult<()>;
    /// チャンネル・メンバー・発言を物理削除する
    fn delete(&self, id: &ChannelId) -> AppResult<()>;
    fn add_member(&self, id: &ChannelId, member: &MemberId) -> AppResult<()>;
    fn remove_member(&self, id: &ChannelId, member: &MemberId) -> AppResult<()>;
    /// 全チャンネルのメンバーから外す
    fn remove_member_everywhere(&self, member: &MemberId) -> AppResult<()>;
}

/// 発言の種類での絞り込み。プロンプトの履歴は、作業の途中の投稿（kind=progress）を別枠で数える（design.md §8）
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MessageFilter {
    /// すべての発言
    All,
    /// 作業の途中の投稿を除く
    WithoutProgress,
    /// 作業の途中の投稿だけ
    ProgressOnly,
}

impl MessageFilter {
    /// 種類 kind の発言がこの絞り込みに合うか
    pub fn matches(self, kind: MessageKind) -> bool {
        match self {
            Self::All => true,
            Self::WithoutProgress => kind != MessageKind::Progress,
            Self::ProgressOnly => kind == MessageKind::Progress,
        }
    }
}

pub trait MessageRepository: Send + Sync {
    /// 保存して seq を振った発言を返す
    fn insert(&self, message: NewMessage) -> AppResult<Message>;
    fn get(&self, id: &MessageId) -> AppResult<Option<Message>>;
    /// filter に合う発言のうち、seq が before_seq より小さい最新 limit 件を、seq の昇順で返す
    fn list(
        &self,
        channel: &ChannelId,
        filter: MessageFilter,
        before_seq: Option<i64>,
        limit: usize,
    ) -> AppResult<Vec<Message>>;
    /// 起点が roots のどれかの発言（それらの会話の発言）で filter に合うもののうち最新 limit 件を、seq の昇順で返す
    fn list_in_conversations(
        &self,
        channel: &ChannelId,
        roots: &[MessageId],
        filter: MessageFilter,
        limit: usize,
    ) -> AppResult<Vec<Message>>;
}

pub trait SkillRepository: Send + Sync {
    /// 名前順
    fn list_for_agent(&self, agent: &AgentId) -> AppResult<Vec<Skill>>;
    fn get(&self, id: &SkillId) -> AppResult<Option<Skill>>;
    /// (agent_id, name) が他のスキルと重なれば Conflict
    fn upsert(&self, skill: &Skill) -> AppResult<()>;
    fn delete(&self, id: &SkillId) -> AppResult<()>;
    fn delete_for_agent(&self, agent: &AgentId) -> AppResult<()>;
}

/// 割り振り（サブタスクを含む）
pub trait DelegationRepository: Send + Sync {
    fn insert(&self, delegation: &Delegation) -> AppResult<()>;
    /// 状態・サブタスクの状態と結果・まとめの発言・更新日時を書き換える
    fn update(&self, delegation: &Delegation) -> AppResult<()>;
    fn get(&self, id: &DelegationId) -> AppResult<Option<Delegation>>;
    /// そのチャンネルの割り振りを createdAt の昇順で（新しい方から limit 件）
    fn list(&self, channel: &ChannelId, limit: usize) -> AppResult<Vec<Delegation>>;
    /// running / reporting の割り振りを、未決着のサブタスクごと cancelled にする（起動時。実行中のジョブは残っていない）。
    /// 打ち切った数を返す
    fn cancel_unfinished(&self, now: i64) -> AppResult<usize>;
}

pub trait StatisticsRepository: Send + Sync {
    fn record_run(&self, run: &RunMeasurement) -> AppResult<()>;
    fn for_channel(&self, channel: &ChannelId) -> AppResult<ChannelStatistics>;
}

pub trait ProfileRepository: Send + Sync {
    /// 未設定なら既定のプロフィール
    fn get(&self) -> AppResult<Profile>;
    fn set(&self, profile: &Profile) -> AppResult<()>;
}

/// 生成したアイコンの枠（ギルドのデータ）
pub trait FrameRepository: Send + Sync {
    /// 作成順
    fn list(&self) -> AppResult<Vec<CustomFrame>>;
    fn get(&self, id: &str) -> AppResult<Option<CustomFrame>>;
    fn insert(&self, frame: &CustomFrame) -> AppResult<()>;
    fn delete(&self, id: &str) -> AppResult<()>;
}

/// データベースの meta 表（スキーマ指紋や初期データ投入の記録）
pub trait MetaRepository: Send + Sync {
    fn get(&self, key: &str) -> AppResult<Option<String>>;
    fn set(&self, key: &str, value: &str) -> AppResult<()>;
}
