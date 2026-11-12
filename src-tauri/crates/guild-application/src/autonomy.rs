//! 自発活動のユースケース（design.md §10）: 30秒ごとの tick と「今すぐ動いてもらう」。

use guild_domain::agent::Agent;
use guild_domain::autonomy::{autonomy_channel, is_autonomy_due};
use guild_domain::conversation::JobSpec;
use guild_domain::ids::AgentId;
use guild_domain::locale;

use crate::conversation::ConversationService;
use crate::error::{subject, AppError, AppResult};
use crate::maintenance::Maintenance;
use crate::services::Ports;

#[derive(Clone)]
pub struct AutonomyService {
    ports: Ports,
    conversation: ConversationService,
    maintenance: Maintenance,
    /// アプリの起動時刻（基準 = max(lastAutonomousAt, 起動時刻)）
    started_at: i64,
}

impl AutonomyService {
    pub fn new(ports: Ports, conversation: ConversationService, maintenance: Maintenance, started_at: i64) -> Self {
        Self { ports, conversation, maintenance, started_at }
    }

    /// 期限が来たエージェントの自発活動を積み、積んだ数を返す。
    /// どこかで待機・実行中のエージェントには積まない。積んだら lastAutonomousAt を更新する
    pub async fn tick(&self, now_ms: i64) -> AppResult<usize> {
        if self.maintenance.is_active() {
            return Ok(0);
        }
        let channels = self.ports.channels.list()?;
        let mut queued = 0;
        for agent in self.ports.agents.list()? {
            if !is_autonomy_due(&agent, now_ms, self.started_at) {
                continue;
            }
            let Some(channel) = autonomy_channel(&agent, &channels) else {
                continue;
            };
            let job = JobSpec::autonomous(agent.id.clone(), channel.id.clone());
            if self.conversation.enqueue_autonomous(job).await {
                self.mark_run(agent, now_ms)?;
                queued += 1;
            }
        }
        if queued > 0 {
            self.ports.events.state_changed();
        }
        Ok(queued)
    }

    /// 自発活動を今すぐ1回積む（待機中のジョブがあれば合流する）
    pub fn run_now(&self, agent_id: &AgentId) -> AppResult<()> {
        let agent =
            self.ports.agents.get(agent_id)?.filter(Agent::is_active).ok_or(AppError::NotFound(subject::agent()))?;
        let channels = self.ports.channels.list()?;
        let channel =
            autonomy_channel(&agent, &channels).ok_or_else(|| AppError::validation(not_in_any_channel(&agent.name)))?;
        self.conversation.enqueue(vec![JobSpec::autonomous(agent.id.clone(), channel.id.clone())]);
        self.mark_run(agent, self.ports.clock.now_ms())?;
        self.ports.events.state_changed();
        Ok(())
    }

    fn mark_run(&self, mut agent: Agent, now_ms: i64) -> AppResult<()> {
        agent.last_autonomous_at = Some(now_ms);
        self.ports.agents.update(&agent)
    }
}

/// 参加しているチャンネルがないので、自発活動を始められないときの文面
fn not_in_any_channel(name: &str) -> String {
    locale::pick([
        format!("{name} はどのチャンネルにも参加していません"),
        format!("{name} is not a member of any channel"),
        format!("{name} 未加入任何频道"),
        format!("{name} 未加入任何頻道"),
        format!("{name}은(는) 어떤 채널에도 참여하고 있지 않습니다"),
    ])
}
