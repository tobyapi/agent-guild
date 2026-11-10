//! インメモリのリポジトリ（SQLite の代わり）: エージェントとチャンネル。残りは records.rs。

use std::collections::HashMap;

use guild_application::ports::{AgentRepository, ChannelRepository, StatisticsRepository};
use guild_application::{AppError, AppResult};
use guild_domain::agent::{name_key, Agent};
use guild_domain::author::MemberId;
use guild_domain::channel::Channel;
use guild_domain::delegation::Delegation;
use guild_domain::ids::{AgentId, ChannelId};
use guild_domain::message::Message;
use guild_domain::profile::Profile;
use guild_domain::skill::Skill;
use guild_domain::statistics::{ChannelStatistics, RunMeasurement};
use parking_lot::Mutex;

#[derive(Default)]
pub struct MemoryStore {
    pub agents: Mutex<Vec<Agent>>,
    pub channels: Mutex<Vec<Channel>>,
    pub messages: Mutex<Vec<Message>>,
    pub delegations: Mutex<Vec<Delegation>>,
    pub measurements: Mutex<Vec<RunMeasurement>>,
    pub skills: Mutex<Vec<Skill>>,
    pub profile: Mutex<Option<Profile>>,
    pub meta: Mutex<HashMap<String, String>>,
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
