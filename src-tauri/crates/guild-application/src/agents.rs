//! エージェントのユースケース: 作成・更新・論理削除・作業場所を開く。

use guild_domain::agent::{ensure_unique_name, normalize_agent_input, Agent, AgentInput};
use guild_domain::author::MemberId;
use guild_domain::ids::AgentId;

use crate::conversation::ConversationService;
use crate::error::{AppError, AppResult};
use crate::services::Ports;

#[derive(Clone)]
pub struct AgentService {
    ports: Ports,
    conversation: ConversationService,
}

impl AgentService {
    pub fn new(ports: Ports, conversation: ConversationService) -> Self {
        Self { ports, conversation }
    }

    pub fn create(&self, input: AgentInput) -> AppResult<Agent> {
        let input = self.validate(input, None)?;
        let agent = Agent::new(AgentId::new(self.ports.ids.new_id()), input, self.ports.clock.now_ms());
        self.ports.agents.insert(&agent)?;
        self.ports.events.state_changed();
        Ok(agent)
    }

    /// 実行中のジョブには影響しない（次のジョブから反映）
    pub fn update(&self, id: &AgentId, input: AgentInput) -> AppResult<Agent> {
        let mut agent = self.require(id)?;
        let input = self.validate(input, Some(id))?;
        agent.apply(input);
        self.ports.agents.update(&agent)?;
        self.ports.events.state_changed();
        Ok(agent)
    }

    /// 論理削除: 待機を除いて実行中を中断し、全チャンネルから外し、スキルと作業フォルダを消す（発言は残る）
    pub async fn delete(&self, id: &AgentId) -> AppResult<()> {
        self.require(id)?;
        self.conversation.remove_agent(id).await;
        self.ports.channels.remove_member_everywhere(&MemberId::Agent(id.clone()))?;
        self.ports.skills.delete_for_agent(id)?;
        self.ports.agents.mark_deleted(id, self.ports.clock.now_ms())?;
        if let Err(error) = self.ports.workspace.remove(id) {
            log::warn!("作業フォルダを削除できませんでした: {error}");
        }
        self.ports.events.state_changed();
        Ok(())
    }

    pub fn open_workspace(&self, id: &AgentId) -> AppResult<()> {
        self.require(id)?;
        self.ports.workspace.reveal(id)
    }

    /// 削除されていないエージェント
    fn require(&self, id: &AgentId) -> AppResult<Agent> {
        self.ports
            .agents
            .get(id)?
            .filter(Agent::is_active)
            .ok_or(AppError::NotFound("エージェント"))
    }

    /// 入力規則（バックエンドの OptionSpec を含む）と、名前の一意性（エージェントと人間の間）
    fn validate(&self, input: AgentInput, self_id: Option<&AgentId>) -> AppResult<AgentInput> {
        let backends = self.ports.runtime.backends();
        let backend = backends.iter().find(|backend| backend.id == input.backend.trim());
        let input = normalize_agent_input(input, backend)?;
        let me = self.ports.profile.get()?;
        ensure_unique_name(&input.name, &self.ports.agents.list()?, self_id, Some(&me.name))?;
        Ok(input)
    }
}
