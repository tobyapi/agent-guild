//! 会話の入口（design.md §6・§7・§9）: 人間の発言の受け付け・停止・削除に伴う中断・ジョブの投入・割り振りの一覧。
//! 実行の管理は dispatcher（単一タスクのアクター）、1ジョブの実行は executor が持つ。

mod activity;
mod attachments;
mod dispatcher;
mod executor;
mod interrupted;
pub(crate) mod posting;

use std::time::Duration;

use guild_domain::activity::ActivityState;
use guild_domain::attachment::{Attachment, NewAttachment};
use guild_domain::author::Author;
use guild_domain::conversation::{parse_mentions, route_human_message, JobSpec, RoutingContext};
use guild_domain::delegation::Delegation;
use guild_domain::ids::{AgentId, AttachmentId, ChannelId, MessageId};
use guild_domain::message::{normalize_human_content, Message, MessageKind};

use crate::error::AppResult;
use crate::maintenance::Maintenance;
use crate::ports::MessageFilter;
use crate::services::Ports;
use dispatcher::DispatcherHandle;
use posting::Origin;

/// 全体の同時実行上限
pub const MAX_CONCURRENT_JOBS: usize = 3;
/// 1ジョブの時間切れ
pub const JOB_TIMEOUT: Duration = Duration::from_secs(15 * 60);
/// list_messages の既定件数と上限
pub const MESSAGE_PAGE_DEFAULT: u32 = 50;
pub const MESSAGE_PAGE_MAX: u32 = 200;
/// list_delegations の上限（新しい方から）
pub const DELEGATION_LIST_MAX: usize = 200;

#[derive(Clone)]
pub struct ConversationService {
    ports: Ports,
    dispatcher: DispatcherHandle,
    maintenance: Maintenance,
}

impl ConversationService {
    /// アクターを起動する（Spawner でタスクを作る）。前回の起動で終わらなかった割り振りは、進めるジョブが
    /// 残っていないので打ち切り、終了で中断された返答は会話ごとに知らせる
    pub fn new(ports: Ports, maintenance: Maintenance) -> Self {
        match ports.delegations.cancel_unfinished(ports.clock.now_ms()) {
            Ok(0) => {}
            Ok(count) => log::info!("前回の起動で終わらなかった割り振りを{count}件打ち切りました"),
            Err(error) => log::warn!("終わらなかった割り振りを打ち切れませんでした: {error}"),
        }
        interrupted::announce(&ports);
        let dispatcher = dispatcher::start(ports.clone());
        Self { ports, dispatcher, maintenance }
    }

    /// 人間の発言（と添えた画像）を保存して message-created を出し、振り分けを始める
    pub fn send_human_message(
        &self,
        channel_id: &ChannelId,
        content: &str,
        images: &[NewAttachment],
    ) -> AppResult<Message> {
        self.maintenance.ensure_available()?;
        let content = normalize_human_content(content, !images.is_empty())?;
        let channel = posting::require_channel(&self.ports, channel_id)?;
        let agents = self.ports.agents.list()?;
        let mentions = parse_mentions(&content, &agents);
        let mut new = posting::new_root(&self.ports, channel_id, Author::Human, content, MessageKind::Chat, mentions);
        new.attachments = attachments::store(&self.ports, channel_id, images)?;
        let message = posting::publish(&self.ports, new)?;
        let ready = posting::ready_backends(&self.ports);
        let ctx = RoutingContext { channel: &channel, agents: &agents, ready_backends: &ready };
        self.dispatcher.dispatch(route_human_message(&message, &ctx), Origin::of(&message));
        Ok(message)
    }

    /// 発言に添えたもののメタデータと中身
    pub fn attachment(&self, message_id: &MessageId, attachment_id: &AttachmentId) -> AppResult<(Attachment, Vec<u8>)> {
        attachments::read(&self.ports, message_id, attachment_id)
    }

    /// 発言に添えたファイルを OS のファイラで表示する
    pub fn reveal_attachment(&self, message_id: &MessageId, attachment_id: &AttachmentId) -> AppResult<()> {
        attachments::reveal(&self.ports, message_id, attachment_id)
    }

    /// seq の昇順。limit の既定は50、上限は200
    pub fn list_messages(&self, channel_id: &ChannelId, before_seq: Option<i64>, limit: Option<u32>) -> AppResult<Vec<Message>> {
        posting::require_channel(&self.ports, channel_id)?;
        let limit = limit.unwrap_or(MESSAGE_PAGE_DEFAULT).clamp(1, MESSAGE_PAGE_MAX);
        self.ports.messages.list(channel_id, MessageFilter::All, before_seq, limit as usize)
    }

    /// そのチャンネルの割り振り（createdAt の昇順。新しい方から最大200件）
    pub fn list_delegations(&self, channel_id: &ChannelId) -> AppResult<Vec<Delegation>> {
        posting::require_channel(&self.ports, channel_id)?;
        self.ports.delegations.list(channel_id, DELEGATION_LIST_MAX)
    }

    /// 単独のシステム発言を出す（初期データの歓迎など）
    pub fn post_system(&self, channel_id: &ChannelId, content: &str) -> AppResult<Message> {
        posting::post_system(&self.ports, channel_id, content)
    }

    /// 待機を破棄し、実行中を中断し、割り振りを打ち切って、その終端を待ってから「停止しました」を出す
    pub async fn stop(&self, channel_id: &ChannelId) -> AppResult<()> {
        posting::require_channel(&self.ports, channel_id)?;
        self.dispatcher.stop(channel_id, true).await;
        Ok(())
    }

    /// チャンネルを消す前に止める（お知らせは出さない）
    pub async fn discard_channel(&self, channel_id: &ChannelId) {
        self.dispatcher.stop(channel_id, false).await;
    }

    /// 全チャンネルを止めて終端を待つ（保存先の変更用）
    pub async fn stop_all(&self) {
        self.dispatcher.stop_all().await;
    }

    /// 削除されたエージェントの待機を全チャンネルから除き、実行中なら中断する（結果は捨てる）
    pub async fn remove_agent(&self, agent: &AgentId) {
        self.dispatcher.remove_agent(agent, None).await;
    }

    /// チャンネルから外したエージェントの、そのチャンネルでの待機と実行を取り消す
    pub async fn remove_member(&self, channel_id: &ChannelId, agent: &AgentId) {
        self.dispatcher.remove_agent(agent, Some(channel_id)).await;
    }

    /// ジョブを積む（同じチャンネル×エージェントの待機ジョブには合流する）
    pub fn enqueue(&self, jobs: Vec<JobSpec>) {
        self.dispatcher.enqueue(jobs);
    }

    /// 自発活動を積む。そのエージェントがどこかで待機・実行中なら積まずに false
    pub async fn enqueue_autonomous(&self, job: JobSpec) -> bool {
        self.dispatcher.enqueue_autonomous(job).await
    }

    /// いまの実行状況
    pub fn activity(&self) -> ActivityState {
        self.dispatcher.activity()
    }
}
