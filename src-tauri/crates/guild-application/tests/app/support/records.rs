//! インメモリのリポジトリ（発言・割り振り・スキル・プロフィール・枠・meta）。

use guild_application::ports::{
    DelegationRepository, FrameRepository, MessageFilter, MessageRepository, MetaRepository, ProfileRepository,
    SkillRepository,
};
use guild_application::AppResult;
use guild_domain::delegation::{Delegation, SubtaskStatus};
use guild_domain::frame::CustomFrame;
use guild_domain::ids::{AgentId, ChannelId, DelegationId, MessageId, SkillId};
use guild_domain::message::{Message, NewMessage};
use guild_domain::profile::Profile;
use guild_domain::skill::Skill;

use super::store::MemoryStore;

impl MessageRepository for MemoryStore {
    fn insert(&self, message: NewMessage) -> AppResult<Message> {
        let mut messages = self.messages.lock();
        let seq = messages.iter().map(|m| m.seq).max().unwrap_or(0) + 1;
        let message = message.into_message(seq);
        messages.push(message.clone());
        Ok(message)
    }
    fn get(&self, id: &MessageId) -> AppResult<Option<Message>> {
        Ok(self.messages.lock().iter().find(|m| &m.id == id).cloned())
    }
    fn list(
        &self,
        channel: &ChannelId,
        filter: MessageFilter,
        before_seq: Option<i64>,
        limit: usize,
    ) -> AppResult<Vec<Message>> {
        let messages = self.messages.lock();
        let matching: Vec<Message> = messages
            .iter()
            .filter(|m| &m.channel_id == channel && filter.matches(m.kind))
            .filter(|m| before_seq.is_none_or(|before| m.seq < before))
            .cloned()
            .collect();
        Ok(matching[matching.len().saturating_sub(limit)..].to_vec())
    }
    fn list_in_conversations(
        &self,
        channel: &ChannelId,
        roots: &[MessageId],
        filter: MessageFilter,
        limit: usize,
    ) -> AppResult<Vec<Message>> {
        let messages = self.messages.lock();
        let matching: Vec<Message> = messages
            .iter()
            .filter(|m| &m.channel_id == channel && roots.contains(&m.root_id) && filter.matches(m.kind))
            .cloned()
            .collect();
        Ok(matching[matching.len().saturating_sub(limit)..].to_vec())
    }
}

impl DelegationRepository for MemoryStore {
    fn insert(&self, delegation: &Delegation) -> AppResult<()> {
        self.delegations.lock().push(delegation.clone());
        Ok(())
    }
    fn update(&self, delegation: &Delegation) -> AppResult<()> {
        let mut delegations = self.delegations.lock();
        if let Some(slot) = delegations.iter_mut().find(|d| d.id == delegation.id) {
            *slot = delegation.clone();
        }
        Ok(())
    }
    fn get(&self, id: &DelegationId) -> AppResult<Option<Delegation>> {
        Ok(self.delegations.lock().iter().find(|d| &d.id == id).cloned())
    }
    fn list(&self, channel: &ChannelId, limit: usize) -> AppResult<Vec<Delegation>> {
        let delegations = self.delegations.lock();
        let matching: Vec<Delegation> = delegations.iter().filter(|d| &d.channel_id == channel).cloned().collect();
        Ok(matching[matching.len().saturating_sub(limit)..].to_vec())
    }
    fn cancel_unfinished(&self, now: i64) -> AppResult<usize> {
        let mut delegations = self.delegations.lock();
        let unfinished = delegations.iter_mut().filter(|d| d.status.is_open());
        Ok(unfinished.map(|d| d.cancel(now)).filter(|changed| *changed).count())
    }
}

/// サブタスクの状態の並び（テストの比較用）
pub fn statuses(delegation: &Delegation) -> Vec<SubtaskStatus> {
    delegation.subtasks.iter().map(|subtask| subtask.status).collect()
}

impl SkillRepository for MemoryStore {
    fn list_for_agent(&self, agent: &AgentId) -> AppResult<Vec<Skill>> {
        Ok(self.skills.lock().iter().filter(|s| &s.agent_id == agent).cloned().collect())
    }
    fn get(&self, id: &SkillId) -> AppResult<Option<Skill>> {
        Ok(self.skills.lock().iter().find(|s| &s.id == id).cloned())
    }
    fn upsert(&self, skill: &Skill) -> AppResult<()> {
        let mut skills = self.skills.lock();
        skills.retain(|s| s.id != skill.id);
        skills.push(skill.clone());
        Ok(())
    }
    fn delete(&self, id: &SkillId) -> AppResult<()> {
        self.skills.lock().retain(|s| &s.id != id);
        Ok(())
    }
    fn delete_for_agent(&self, agent: &AgentId) -> AppResult<()> {
        self.skills.lock().retain(|s| &s.agent_id != agent);
        Ok(())
    }
}

impl ProfileRepository for MemoryStore {
    fn get(&self) -> AppResult<Profile> {
        Ok(self.profile.lock().clone().unwrap_or_default())
    }
    fn set(&self, profile: &Profile) -> AppResult<()> {
        *self.profile.lock() = Some(profile.clone());
        Ok(())
    }
}

impl FrameRepository for MemoryStore {
    fn list(&self) -> AppResult<Vec<CustomFrame>> {
        Ok(self.frames.lock().clone())
    }
    fn get(&self, id: &str) -> AppResult<Option<CustomFrame>> {
        Ok(self.frames.lock().iter().find(|frame| frame.id == id).cloned())
    }
    fn insert(&self, frame: &CustomFrame) -> AppResult<()> {
        self.frames.lock().push(frame.clone());
        Ok(())
    }
    fn delete(&self, id: &str) -> AppResult<()> {
        self.frames.lock().retain(|frame| frame.id != id);
        Ok(())
    }
}

impl MetaRepository for MemoryStore {
    fn get(&self, key: &str) -> AppResult<Option<String>> {
        Ok(self.meta.lock().get(key).cloned())
    }
    fn set(&self, key: &str, value: &str) -> AppResult<()> {
        self.meta.lock().insert(key.to_owned(), value.to_owned());
        Ok(())
    }
}
