//! 発言の保存と message-created の発行、参加とお知らせ。

use guild_domain::author::{Author, MemberId};
use guild_domain::channel::Channel;
use guild_domain::conversation::notices;
use guild_domain::ids::{AgentId, ChannelId, MessageId};
use guild_domain::message::{Message, MessageKind, NewMessage};

use crate::error::{AppError, AppResult};
use crate::services::Ports;

/// 振り分けのきっかけになった発言（お知らせの起点と depth を引き継ぐ）
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Origin {
    pub channel_id: ChannelId,
    pub root_id: MessageId,
    pub depth: u32,
}

impl Origin {
    pub fn of(message: &Message) -> Self {
        Self {
            channel_id: message.channel_id.clone(),
            root_id: message.root_id.clone(),
            depth: message.depth,
        }
    }
}

/// 保存して message-created を出す
pub(crate) fn publish(ports: &Ports, message: NewMessage) -> AppResult<Message> {
    let message = ports.messages.insert(message)?;
    ports.events.message_created(&message);
    Ok(message)
}

/// 起点になる発言（rootId は自分、depth 0）
pub(crate) fn new_root(
    ports: &Ports,
    channel_id: &ChannelId,
    author: Author,
    content: String,
    kind: MessageKind,
    mentions: Vec<AgentId>,
) -> NewMessage {
    let id = MessageId::new(ports.ids.new_id());
    NewMessage {
        root_id: id.clone(),
        id,
        channel_id: channel_id.clone(),
        author_id: author,
        content,
        attachments: Vec::new(),
        kind,
        mentions,
        reply_to_id: None,
        depth: 0,
        delegation_id: None,
        created_at: ports.clock.now_ms(),
    }
}

/// 会話の中のお知らせ（起点と depth を引き継ぐシステム発言）
pub(crate) fn post_notice(ports: &Ports, origin: &Origin, content: &str) -> AppResult<Message> {
    let mut message = new_root(ports, &origin.channel_id, Author::System, content.to_owned(), MessageKind::System, Vec::new());
    message.root_id = origin.root_id.clone();
    message.depth = origin.depth;
    publish(ports, message)
}

/// 単独のシステム発言（停止・歓迎など。起点は自分）
pub(crate) fn post_system(ports: &Ports, channel_id: &ChannelId, content: &str) -> AppResult<Message> {
    let message = new_root(ports, channel_id, Author::System, content.to_owned(), MessageKind::System, Vec::new());
    publish(ports, message)
}

/// チャンネル外のエージェントを参加させ、「{名前} がチャンネルに参加しました」を出す
pub(crate) fn join(ports: &Ports, origin: &Origin, agents: &[AgentId]) -> AppResult<()> {
    if agents.is_empty() {
        return Ok(());
    }
    let all = ports.agents.list()?;
    for id in agents {
        ports.channels.add_member(&origin.channel_id, &MemberId::Agent(id.clone()))?;
        if let Some(agent) = all.iter().find(|agent| &agent.id == id) {
            post_notice(ports, origin, &notices::joined(&agent.name))?;
        }
    }
    ports.events.state_changed();
    Ok(())
}

pub(crate) fn require_channel(ports: &Ports, id: &ChannelId) -> AppResult<Channel> {
    ports.channels.get(id)?.ok_or(AppError::NotFound("チャンネル"))
}

/// status が ready のバックエンドの ID
pub(crate) fn ready_backends(ports: &Ports) -> Vec<String> {
    ports
        .runtime
        .backends()
        .into_iter()
        .filter(|backend| backend.is_ready())
        .map(|backend| backend.id)
        .collect()
}
