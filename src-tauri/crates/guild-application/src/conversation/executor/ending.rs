//! ジョブの結末と、確定した結果（アクターがサブタスクの決着・まとめ・振り分けに使う）。

use guild_domain::conversation::Routing;
use guild_domain::delegation::{Delegation, Turn};
use guild_domain::message::Message;

use crate::conversation::posting::Origin;

/// ジョブの結末（サブタスクの決着とまとめに使う）
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum Ending {
    /// 返答を投稿した。continues = その返答が新しい相談か割り振りを作った
    Replied { message: Message, continues: bool },
    /// [PASS]・空の返答
    Passed,
    /// 失敗（エラー発言）
    Failed(Message),
    /// 時間切れ（エラー発言）
    TimedOut(Message),
    /// 中断・取り消しなどで何も起きなかった
    Nothing,
}

impl Ending {
    /// 決着の判定に渡す結末（何も起きなかったなら None）
    pub fn turn(&self) -> Option<Turn<'_>> {
        Some(match self {
            Self::Replied { message, continues } => Turn::Replied { message: &message.id, continues: *continues },
            Self::Passed => Turn::Passed,
            Self::Failed(error) => Turn::Failed { error: &error.id },
            Self::TimedOut(error) => Turn::TimedOut { error: &error.id },
            Self::Nothing => return None,
        })
    }

    /// 投稿した返答かエラー発言
    pub fn message(&self) -> Option<&Message> {
        match self {
            Self::Replied { message, .. } | Self::Failed(message) | Self::TimedOut(message) => Some(message),
            Self::Passed | Self::Nothing => None,
        }
    }
}

/// 確定した結果
pub(crate) struct Committed {
    /// 振り分けの結果ときっかけ（何も振り分けないなら None）
    pub routing: Option<(Routing, Origin)>,
    pub ending: Ending,
    /// 返答の tasks ブロックから作った割り振り
    pub delegation: Option<Delegation>,
}

impl Committed {
    pub(super) fn nothing() -> Self {
        Self { routing: None, ending: Ending::Nothing, delegation: None }
    }
}
