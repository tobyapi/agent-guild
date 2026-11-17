//! インメモリのリポジトリ（SQLite の代わり）: エージェントとチャンネル。残りは records.rs。

use std::collections::HashMap;

use guild_application::ports::{AgentRepository, ChannelRepository, SkillRecordRepository, StatisticsRepository};
use guild_application::{AppError, AppResult};
use guild_domain::agent::{name_key, Agent};
use guild_domain::author::MemberId;
use guild_domain::channel::Channel;
use guild_domain::delegation::Delegation;
use guild_domain::frame::CustomFrame;
use guild_domain::ids::{AgentId, ChannelId};
use guild_domain::message::Message;
use guild_domain::profile::Profile;
use guild_domain::skill::Skill;
use guild_domain::statistics::{ChannelStatistics, RunMeasurement};
use parking_lot::Mutex;

#[derive(Default)]
pub struct MemoryStore {
    pub agents: Mutex<Vec<Agent>>,
    pub creation_audit: Mutex<Vec<(AgentId, String, String)>>,
    pub creations: Mutex<Vec<(AgentId, String, String, AgentId)>>,
    pub channels: Mutex<Vec<Channel>>,
    pub messages: Mutex<Vec<Message>>,
    pub reject_next_final: Mutex<bool>,
    pub reject_next_progress: Mutex<bool>,
    pub skill_cutoffs: Mutex<Vec<String>>,
    pub reject_next_cutoff: Mutex<bool>,
    pub delegations: Mutex<Vec<Delegation>>,
    pub measurements: Mutex<Vec<RunMeasurement>>,
    pub skills: Mutex<Vec<Skill>>,
    pub profile: Mutex<Option<Profile>>,
    pub frames: Mutex<Vec<CustomFrame>>,
    pub meta: Mutex<HashMap<String, String>>,
    pub reject_notification_receipts: Mutex<bool>,
}

impl SkillRecordRepository for MemoryStore {
    fn truncate(&self, job_id: &str, _channel: &ChannelId) -> AppResult<()> {
        if std::mem::take(&mut *self.reject_next_cutoff.lock()) {
            return Err(AppError::Storage("injected cutoff failure".into()));
        }
        self.skill_cutoffs.lock().push(job_id.into());
        Ok(())
    }
    fn is_truncated(&self, job_id: &str) -> AppResult<bool> {
        Ok(self.skill_cutoffs.lock().iter().any(|id| id == job_id))
    }
}

impl StatisticsRepository for MemoryStore {
    fn record_run(&self, run: &RunMeasurement) -> AppResult<()> {
        self.measurements.lock().push(run.clone());
        Ok(())
    }

    fn for_channel(&self, _channel: &ChannelId) -> AppResult<ChannelStatistics> {
        Ok(ChannelStatistics::default())
    }
}

impl AgentRepository for MemoryStore {
    fn list(&self) -> AppResult<Vec<Agent>> {
        Ok(self.agents.lock().clone())
    }
    fn get(&self, id: &AgentId) -> AppResult<Option<Agent>> {
        Ok(self.agents.lock().iter().find(|a| &a.id == id).cloned())
    }
    fn insert(&self, agent: &Agent) -> AppResult<()> {
        let mut agents = self.agents.lock();
        if agents.iter().any(|a| a.is_active() && name_key(&a.name) == name_key(&agent.name)) {
            return Err(AppError::validation("その名前はすでに使われています"));
        }
        agents.push(agent.clone());
        Ok(())
    }
    fn insert_from_agent(
        &self,
        actor: &AgentId,
        run_id: &str,
        message_id: &guild_domain::ids::MessageId,
        request_id: &str,
        registration: &guild_application::ports::AgentRegistration<'_>,
    ) -> AppResult<Agent> {
        let agent = registration.agent;
        let mut agents = self.agents.lock();
        if !agents
            .iter()
            .any(|a| &a.id == actor && a.is_active() && guild_domain::agent::role_can_create_agents(&a.tags))
        {
            return Err(AppError::validation("manager_required"));
        }
        let mut receipts = self.creations.lock();
        if let Some((_, _, _, id)) =
            receipts.iter().find(|(a, key, run, _)| a == actor && (key == request_id || run == run_id))
        {
            return agents
                .iter()
                .find(|a| &a.id == id)
                .cloned()
                .ok_or_else(|| AppError::validation("missing_receipt_target"));
        }
        if !self.messages.lock().iter().any(|m| &m.id == message_id && m.author_id.agent_id() == Some(actor)) {
            return Err(AppError::validation("invalid_source"));
        }
        let human = self.profile.lock().clone().unwrap_or_default();
        if name_key(&human.name) == name_key(&agent.name)
            || agents.iter().any(|a| a.is_active() && name_key(&a.name) == name_key(&agent.name))
        {
            return Err(AppError::validation("name_taken"));
        }
        agents.push(agent.clone());
        self.skills.lock().extend_from_slice(registration.skills);
        for channel in self.channels.lock().iter_mut().filter(|c| registration.channels.contains(&c.id)) {
            let member = MemberId::Agent(agent.id.clone());
            if !channel.has_member(&member) {
                channel.member_ids.push(member);
            }
        }
        receipts.push((actor.clone(), request_id.into(), run_id.into(), agent.id.clone()));
        Ok(agent.clone())
    }
    fn record_creation_attempt(
        &self,
        actor: &AgentId,
        _message: &guild_domain::ids::MessageId,
        reason: &str,
        claims: &str,
        _at: i64,
    ) -> AppResult<()> {
        self.creation_audit.lock().push((actor.clone(), reason.into(), claims.into()));
        Ok(())
    }
    fn update(&self, agent: &Agent) -> AppResult<()> {
        let mut agents = self.agents.lock();
        if let Some(slot) = agents.iter_mut().find(|a| a.id == agent.id) {
            *slot = agent.clone();
        }
        Ok(())
    }
    fn mark_deleted(&self, id: &AgentId, deleted_at: i64) -> AppResult<()> {
        let mut agents = self.agents.lock();
        agents.iter_mut().filter(|a| &a.id == id).for_each(|a| a.deleted_at = Some(deleted_at));
        Ok(())
    }
}

impl ChannelRepository for MemoryStore {
    fn list(&self) -> AppResult<Vec<Channel>> {
        Ok(self.channels.lock().clone())
    }
    fn get(&self, id: &ChannelId) -> AppResult<Option<Channel>> {
        Ok(self.channels.lock().iter().find(|c| &c.id == id).cloned())
    }
    fn insert(&self, channel: &Channel) -> AppResult<()> {
        self.channels.lock().push(channel.clone());
        Ok(())
    }
    fn update(&self, channel: &Channel) -> AppResult<()> {
        let mut channels = self.channels.lock();
        if let Some(slot) = channels.iter_mut().find(|c| c.id == channel.id) {
            slot.name = channel.name.clone();
            slot.topic = channel.topic.clone();
            slot.icon = channel.icon.clone();
        }
        Ok(())
    }
    fn delete(&self, id: &ChannelId) -> AppResult<()> {
        self.channels.lock().retain(|c| &c.id != id);
        self.messages.lock().retain(|m| &m.channel_id != id);
        self.delegations.lock().retain(|d| &d.channel_id != id);
        Ok(())
    }
    fn add_member(&self, id: &ChannelId, member: &MemberId) -> AppResult<()> {
        let mut channels = self.channels.lock();
        let channel = channels.iter_mut().find(|c| &c.id == id);
        if let Some(channel) = channel.filter(|c| !c.has_member(member)) {
            channel.member_ids.push(member.clone());
        }
        Ok(())
    }
    fn remove_member(&self, id: &ChannelId, member: &MemberId) -> AppResult<()> {
        let mut channels = self.channels.lock();
        channels.iter_mut().filter(|c| &c.id == id).for_each(|c| c.member_ids.retain(|m| m != member));
        Ok(())
    }
    fn remove_member_everywhere(&self, member: &MemberId) -> AppResult<()> {
        self.channels.lock().iter_mut().for_each(|c| c.member_ids.retain(|m| m != member));
        Ok(())
    }
}
