//! メッセージ（チャンネルへの発言）。

use serde::{Deserialize, Serialize};

use super::attachment::Attachment;
use super::author::Author;
use super::error::{ensure_max_chars, ValidationError};
use super::ids::{AgentId, ChannelId, DelegationId, MessageId};

/// 人間が1回に送れる最大文字数
pub const HUMAN_MESSAGE_MAX_CHARS: usize = 20_000;

/// メッセージの種類
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageKind {
    /// 通常の発言
    Chat,
    /// 自発活動での発言
    Autonomous,
    /// 作業の途中の投稿（進捗状況や困っていること）。振り分けない
    Progress,
    /// システムのお知らせ（参加・停止・上限など）
    System,
    /// エージェントの実行失敗
    Error,
}

impl MessageKind {
    /// 保存で使う識別子
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Chat => "chat",
            Self::Autonomous => "autonomous",
            Self::Progress => "progress",
            Self::System => "system",
            Self::Error => "error",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "chat" => Some(Self::Chat),
            "autonomous" => Some(Self::Autonomous),
            "progress" => Some(Self::Progress),
            "system" => Some(Self::System),
            "error" => Some(Self::Error),
            _ => None,
        }
    }

    /// 振り分けの対象か（chat と autonomous だけ）
    pub fn is_routable(self) -> bool {
        matches!(self, Self::Chat | Self::Autonomous)
    }
}

/// メッセージ（TS の Message）
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Message {
    pub id: MessageId,
    /// 全体で単調増加する通し番号（並び順とページングのカーソル）
    pub seq: i64,
    pub channel_id: ChannelId,
    pub author_id: Author,
    pub content: String,
    /// 人間が貼った画像（貼った順）。人間の発言以外は空
    pub attachments: Vec<Attachment>,
    pub kind: MessageKind,
    /// このメッセージで呼びかけられたエージェント（本文に現れた順）
    pub mentions: Vec<AgentId>,
    pub reply_to_id: Option<MessageId>,
    /// 会話の起点（人間の発言・自発投稿）の id。起点自身は自分の id
    pub root_id: MessageId,
    /// 人間の発言からの AI 往復回数（人間の発言は 0）
    pub depth: u32,
    /// この発言（マネージャーの tasks ブロック）から作られた割り振り
    pub delegation_id: Option<DelegationId>,
    /// 表示専用（並びには seq を使う）
    pub created_at: i64,
}

/// 保存前のメッセージ（seq は保存したときに決まる）
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NewMessage {
    pub id: MessageId,
    pub channel_id: ChannelId,
    pub author_id: Author,
    pub content: String,
    pub attachments: Vec<Attachment>,
    pub kind: MessageKind,
    pub mentions: Vec<AgentId>,
    pub reply_to_id: Option<MessageId>,
    pub root_id: MessageId,
    pub depth: u32,
    pub delegation_id: Option<DelegationId>,
    pub created_at: i64,
}

impl NewMessage {
    pub fn into_message(self, seq: i64) -> Message {
        Message {
            id: self.id,
            seq,
            channel_id: self.channel_id,
            author_id: self.author_id,
            content: self.content,
            attachments: self.attachments,
            kind: self.kind,
            mentions: self.mentions,
            reply_to_id: self.reply_to_id,
            root_id: self.root_id,
            depth: self.depth,
            delegation_id: self.delegation_id,
            created_at: self.created_at,
        }
    }
}

/// 人間の発言を正規化する（前後の空白を除き、長すぎるものを拒む）。画像を添えるなら本文は空でもよい
pub fn normalize_human_content(content: &str, has_attachments: bool) -> Result<String, ValidationError> {
    let content = content.trim();
    if content.is_empty() && !has_attachments {
        return Err(ValidationError::on("content", "メッセージを入力してください"));
    }
    ensure_max_chars(content, HUMAN_MESSAGE_MAX_CHARS, "content", "メッセージが長すぎます（20000文字まで）")?;
    Ok(content.to_owned())
}
