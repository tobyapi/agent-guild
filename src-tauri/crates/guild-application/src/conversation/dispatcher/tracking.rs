//! 進行中の割り振りの記録（アクターのメモリの中だけ。再起動で残っていた割り振りは起動時に打ち切る）。

use std::collections::HashMap;

use guild_domain::delegation::{Delegation, SubtaskRef};
use guild_domain::ids::{MessageId, SubtaskId};
use guild_domain::message::Message;

pub(crate) struct Tracked {
    /// DB と同じ最新の値
    pub delegation: Delegation,
    /// 割り振りを作った返答の起点と depth（まとめのジョブに引き継ぐ）
    pub root_id: MessageId,
    pub depth: u32,
    /// 担当者として待っているサブタスク（入れ子の割り振り。まとめのジョブが引き継ぐ）
    pub parent: Option<SubtaskRef>,
    /// サブタスクごとの最新の発言（待ち中の返答・結果の報告・エラー発言）。まとめのきっかけと、
    /// 相談の連鎖が途切れたときの結果に使う
    pub messages: HashMap<SubtaskId, Message>,
}

impl Tracked {
    /// まとめのきっかけ: 結果の発言（done の返答・failed のエラー発言）を seq 順に
    pub fn results(&self) -> Vec<Message> {
        let mut results: Vec<Message> = self
            .delegation
            .subtasks
            .iter()
            .filter_map(|subtask| {
                let message = self.messages.get(&subtask.id)?;
                (subtask.result_message_id.as_ref() == Some(&message.id)).then(|| message.clone())
            })
            .collect();
        results.sort_by_key(|message| message.seq);
        results.dedup_by(|a, b| a.id == b.id);
        results
    }
}
