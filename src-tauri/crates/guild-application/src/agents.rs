//! エージェントのユースケース: 作成・更新・論理削除・作業場所を開く。

use guild_domain::agent::{ensure_unique_name, normalize_agent_input, Agent, AgentInput};
use guild_domain::author::MemberId;
use guild_domain::ids::AgentId;

use crate::channels::ChannelService;
use crate::conversation::ConversationService;
use crate::error::{AppError, AppResult};
use crate::services::Ports;
use crate::skills::SkillService;

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
        SkillService::new(self.ports.clone()).add_role_defaults(&agent)?;
        // 表示名に依存せず、保存されたロビーフラグで探す。
        // 自動参加の失敗で、作成済みのエージェントを失敗扱いにしない。
        if let Err(error) = self.join_lobby(&agent) {
            log::warn!("新しいエージェントをロビーに追加できませんでした: {error}");
        }
        self.ports.events.state_changed();
        Ok(agent)
    }

    fn join_lobby(&self, agent: &Agent) -> AppResult<()> {
        if let Some(lobby) = self.ports.channels.list()?.into_iter().find(|channel| channel.is_lobby) {
            ChannelService::new(self.ports.clone(), self.conversation.clone())
                .add_member(&lobby.id, &MemberId::Agent(agent.id.clone()))?;
        }
        Ok(())
    }

    /// 実行中のジョブには影響しない（次のジョブから反映）
    pub fn update(&self, id: &AgentId, input: AgentInput) -> AppResult<Agent> {
        let mut agent = self.require(id)?;
        let input = self.validate(input, Some(id))?;
        let changed_role =
            guild_domain::agent::role_template(&agent.tags) != guild_domain::agent::role_template(&input.tags);
        agent.apply(input);
        self.ports.agents.update(&agent)?;
        if changed_role {
            SkillService::new(self.ports.clone()).add_role_defaults(&agent)?;
        }
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
        self.ports.agents.get(id)?.filter(Agent::is_active).ok_or(AppError::NotFound("エージェント"))
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
