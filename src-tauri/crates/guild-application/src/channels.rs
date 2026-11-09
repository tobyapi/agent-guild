//! チャンネルのユースケース: 作成・更新・削除・メンバーの追加と除外。

use guild_domain::author::MemberId;
use guild_domain::channel::{normalize_channel_name, normalize_channel_topic, normalize_members, Channel};
use guild_domain::conversation::notices;
use guild_domain::ids::{AgentId, ChannelId};

use crate::conversation::{posting, ConversationService};
use crate::error::{AppError, AppResult};
use crate::services::Ports;

#[derive(Clone)]
pub struct ChannelService {
    ports: Ports,
    conversation: ConversationService,
}

impl ChannelService {
    pub fn new(ports: Ports, conversation: ConversationService) -> Self {
        Self { ports, conversation }
    }

    /// 人間は常にメンバーに入る
    pub fn create(&self, name: &str, topic: &str, member_ids: &[MemberId]) -> AppResult<Channel> {
        let members = normalize_members(member_ids);
        for member in &members {
            if let MemberId::Agent(id) = member {
                self.require_agent(id)?;
            }
        }
        let channel = Channel {
            id: ChannelId::new(self.ports.ids.new_id()),
            name: normalize_channel_name(name)?,
            topic: normalize_channel_topic(topic)?,
            member_ids: members,
            created_at: self.ports.clock.now_ms(),
        };
        self.ports.channels.insert(&channel)?;
        self.ports.events.state_changed();
        Ok(channel)
    }

    pub fn update(&self, id: &ChannelId, name: &str, topic: &str) -> AppResult<Channel> {
        let mut channel = posting::require_channel(&self.ports, id)?;
        channel.name = normalize_channel_name(name)?;
        channel.topic = normalize_channel_topic(topic)?;
        self.ports.channels.update(&channel)?;
        self.ports.events.state_changed();
        Ok(channel)
    }

    /// 停止と同じ処理（終端を待つ）のあと、チャンネル・メンバー・発言を物理削除する
    pub async fn delete(&self, id: &ChannelId) -> AppResult<()> {
        posting::require_channel(&self.ports, id)?;
        self.conversation.discard_channel(id).await;
        self.ports.channels.delete(id)?;
        if let Err(error) = self.ports.attachments.delete_channel(id) {
            log::warn!("チャンネルの画像を消せませんでした: {error}");
        }
        self.ports.events.state_changed();
        Ok(())
    }

    /// エージェントを参加させ「{名前} がチャンネルに参加しました」を出す（参加済みなら何もしない）
    pub fn add_member(&self, channel_id: &ChannelId, member: &MemberId) -> AppResult<()> {
        let channel = posting::require_channel(&self.ports, channel_id)?;
        let MemberId::Agent(agent_id) = member else {
            return Ok(());
        };
        let name = self.require_agent(agent_id)?;
        if channel.has_member(member) {
            return Ok(());
        }
        self.ports.channels.add_member(channel_id, member)?;
        posting::post_system(&self.ports, channel_id, &notices::joined(&name))?;
        self.ports.events.state_changed();
        Ok(())
    }

    /// そのチャンネルでの待機を除き、実行中なら中断してからメンバーから外す（人間は外せない）
    pub async fn remove_member(&self, channel_id: &ChannelId, member: &MemberId) -> AppResult<()> {
        posting::require_channel(&self.ports, channel_id)?;
        let MemberId::Agent(agent_id) = member else {
            return Err(AppError::validation("人間はチャンネルから外せません"));
        };
        self.conversation.remove_member(channel_id, agent_id).await;
        self.ports.channels.remove_member(channel_id, member)?;
        self.ports.events.state_changed();
        Ok(())
    }

    /// 削除されていないエージェントの名前
    fn require_agent(&self, id: &AgentId) -> AppResult<String> {
        self.ports
            .agents
            .get(id)?
            .filter(|agent| agent.is_active())
            .map(|agent| agent.name)
            .ok_or(AppError::NotFound("エージェント"))
    }
}
