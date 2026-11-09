//! 実行待ちジョブの仕様と、レーンでの合流規則（design.md §6）。

use crate::delegation::SubtaskRef;
use crate::ids::{AgentId, ChannelId, DelegationId, MessageId};
use crate::message::Message;

/// ジョブのモード。合流したときは強い方（Reply > Return > Autonomous）で上書きする。
/// task と report は割り振りのジョブで、ほかのジョブとは合流しない（合流の条件にサブタスクとまとめを含めるため）
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum JobMode {
    /// 自発活動（誰にも話しかけられていない）
    Autonomous,
    /// 相談した相手から返答が届いた（または届かなかった）ので、元の作業を続ける
    Return,
    /// 呼びかけ（人間の発言・メンション）への返答
    Reply,
    /// 割り振ったタスクの結果がそろったので、マネージャーがまとめる
    Report,
    /// マネージャーから割り振られたタスク
    Task,
}

/// 1回分のエージェント実行の依頼
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JobSpec {
    pub agent_id: AgentId,
    pub channel_id: ChannelId,
    pub mode: JobMode,
    /// あなた宛ての未対応の発言（seq 順・重複なし。自発活動や「回答なし」の戻りでは空）
    pub triggers: Vec<Message>,
    /// 返答したら（または返答がなければ注記つきで）この相手たちに return ジョブを積む
    pub return_to: Vec<AgentId>,
    /// このジョブで生まれる返答の depth
    pub depth: u32,
    /// 会話の起点。自発活動では None（投稿した発言が起点になる）
    pub root_id: Option<MessageId>,
    /// プロンプトに添える注記（例: 「ロジカ は回答しませんでした」）
    pub notes: Vec<String>,
    /// 決着させるサブタスク（task ジョブ・担当者の相談の連鎖・担当者のまとめのジョブ。§7.1）
    pub subtask: Option<SubtaskRef>,
    /// まとめる割り振り（report ジョブ）
    pub report: Option<DelegationId>,
}

impl JobSpec {
    /// きっかけの発言 trigger に応えるジョブ（depth はきっかけ + 1、起点はきっかけの起点）
    pub fn respond(agent_id: AgentId, trigger: &Message, mode: JobMode, return_to: Vec<AgentId>) -> Self {
        Self {
            agent_id,
            channel_id: trigger.channel_id.clone(),
            mode,
            triggers: vec![trigger.clone()],
            return_to,
            depth: trigger.depth + 1,
            root_id: Some(trigger.root_id.clone()),
            notes: Vec::new(),
            subtask: None,
            report: None,
        }
    }

    /// 割り振りのサブタスクの task ジョブ（きっかけはマネージャーの返答。returnTo は持たない）
    pub fn task(trigger: &Message, subtask: SubtaskRef) -> Self {
        let assignee = subtask.assignee_id.clone();
        Self { subtask: Some(subtask), ..Self::respond(assignee, trigger, JobMode::Task, Vec::new()) }
    }

    /// 割り振りの枠（§6）で実行するジョブか: サブタスクを持つ task ジョブと担当者の相談の連鎖。まとめはレーンに積む
    pub fn is_delegated(&self) -> bool {
        self.subtask.is_some() && self.report.is_none()
    }

    /// 自発活動のジョブ
    pub fn autonomous(agent_id: AgentId, channel_id: ChannelId) -> Self {
        Self {
            agent_id,
            channel_id,
            mode: JobMode::Autonomous,
            triggers: Vec::new(),
            return_to: Vec::new(),
            depth: 1,
            root_id: None,
            notes: Vec::new(),
            subtask: None,
            report: None,
        }
    }

    /// いちばん新しいきっかけ（返答の replyToId になる）
    pub fn latest_trigger(&self) -> Option<&Message> {
        self.triggers.last()
    }

    /// 合流できるか: 同じチャンネルの同じエージェントで、サブタスクとまとめも同じジョブ
    pub fn can_merge(&self, other: &JobSpec) -> bool {
        self.agent_id == other.agent_id
            && self.channel_id == other.channel_id
            && self.subtask == other.subtask
            && self.report == other.report
    }

    /// 待機中のジョブに合流する: きっかけ・returnTo・注記は和集合、モードは強い方、depth は大きい方、
    /// 起点は新しい方に寄せる
    pub fn merge(&mut self, other: JobSpec) {
        for trigger in other.triggers {
            if !self.triggers.iter().any(|known| known.id == trigger.id) {
                self.triggers.push(trigger);
            }
        }
        self.triggers.sort_by_key(|message| message.seq);
        self.mode = self.mode.max(other.mode);
        extend_unique(&mut self.return_to, other.return_to);
        extend_unique(&mut self.notes, other.notes);
        self.depth = self.depth.max(other.depth);
        if other.root_id.is_some() {
            self.root_id = other.root_id;
        }
    }
}

fn extend_unique<T: PartialEq>(target: &mut Vec<T>, items: Vec<T>) {
    for item in items {
        if !target.contains(&item) {
            target.push(item);
        }
    }
}
