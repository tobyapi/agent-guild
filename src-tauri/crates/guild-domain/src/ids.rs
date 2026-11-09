//! エンティティ ID のニュータイプ。JSON ではただの文字列（UUID）。

use std::fmt;

use serde::{Deserialize, Serialize};

macro_rules! define_id {
    ($(#[$meta:meta])* $name:ident) => {
        $(#[$meta])*
        #[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
        #[serde(transparent)]
        pub struct $name(String);

        impl $name {
            pub fn new(value: impl Into<String>) -> Self {
                Self(value.into())
            }

            pub fn as_str(&self) -> &str {
                &self.0
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                f.write_str(&self.0)
            }
        }
    };
}

define_id!(
    /// エージェントの ID
    AgentId
);
define_id!(
    /// チャンネルの ID
    ChannelId
);
define_id!(
    /// メッセージの ID
    MessageId
);
define_id!(
    /// スキルの ID
    SkillId
);
define_id!(
    /// 添付（人間が発言に貼った画像）の ID
    AttachmentId
);
define_id!(
    /// 割り振り（マネージャーの tasks ブロックから作ったもの）の ID
    DelegationId
);
define_id!(
    /// 割り振りのサブタスクの ID
    SubtaskId
);
