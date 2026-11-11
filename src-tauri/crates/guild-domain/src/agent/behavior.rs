//! 振る舞いの設定のまとめ。振り分け・プロンプト・自発活動・実効権限は、エージェントの振る舞いをここ（Agent::behavior）
//! からだけ読む。権限の役割表や設定の置き場所が変わっても、直すのはこの関数の中身だけで済む。

use super::{role_permissions, Agent, Permissions, UnmentionedPolicy};

/// エージェントの振る舞いを決める設定
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Behavior {
    /// 役割の権限（どのバックエンドでも同じ。そのバックエンドで実際に使える操作は effective_permissions）
    pub permissions: Permissions,
    /// メンションのない人間の発言への反応
    pub unmentioned: UnmentionedPolicy,
    /// 他のエージェントにメンションされたら、チャンネル外からでも参加して答える
    pub consultable: bool,
    /// tasks ブロックでタスクを割り振れる（マネージャー）
    pub can_delegate: bool,
    /// 自発活動をする
    pub autonomy_enabled: bool,
}

impl Agent {
    pub fn behavior(&self) -> Behavior {
        Behavior {
            permissions: role_permissions(&self.tags),
            unmentioned: self.unmentioned,
            consultable: self.consultable,
            can_delegate: self.can_delegate,
            autonomy_enabled: self.autonomy_enabled,
        }
    }
}
