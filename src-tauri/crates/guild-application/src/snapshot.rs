//! 全体像（Snapshot）の組み立て。

use guild_domain::agent::templates;
use guild_domain::snapshot::Snapshot;

use crate::conversation::ConversationService;
use crate::error::AppResult;
use crate::guild;
use crate::services::Ports;

#[derive(Clone)]
pub struct SnapshotService {
    ports: Ports,
    conversation: ConversationService,
}

impl SnapshotService {
    pub fn new(ports: Ports, conversation: ConversationService) -> Self {
        Self { ports, conversation }
    }

    /// エージェントは削除済みも含む
    pub fn get(&self) -> AppResult<Snapshot> {
        let backends = self.ports.runtime.backends();
        let mut agents = self.ports.agents.list()?;
        // 権限は役割だけで決まる（バックエンドでは変わらない）。保存値が古くても、いまの役割表の値を返す
        for agent in &mut agents {
            agent.permissions = agent.behavior().permissions;
        }
        Ok(Snapshot {
            guild: guild::load(&self.ports)?,
            me: self.ports.profile.get()?,
            agents,
            channels: self.ports.channels.list()?,
            backends,
            templates: templates(),
            frames: self.ports.frames.list()?,
            runtime: self.ports.runtime.status(),
            activity: self.conversation.activity(),
        })
    }
}
