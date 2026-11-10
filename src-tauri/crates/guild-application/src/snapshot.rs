//! 全体像（Snapshot）の組み立て。

use guild_domain::agent::{effective_permissions, templates};
use guild_domain::snapshot::Snapshot;

use crate::conversation::ConversationService;
use crate::error::AppResult;
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
        for agent in &mut agents {
            let backend = backends.iter().find(|backend| backend.id == agent.backend);
            agent.permissions = effective_permissions(agent, backend);
        }
        Ok(Snapshot {
            me: self.ports.profile.get()?,
            agents,
            channels: self.ports.channels.list()?,
            backends,
            templates: templates(),
            runtime: self.ports.runtime.status(),
            activity: self.conversation.activity(),
        })
    }
}
