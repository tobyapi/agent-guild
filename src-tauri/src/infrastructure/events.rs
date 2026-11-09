//! React へのイベント（EventPublisher の実装）。名前とペイロードは design.md §4。

use guild_application::ports::EventPublisher;
use guild_domain::activity::ActivityState;
use guild_domain::delegation::Delegation;
use guild_domain::ids::AgentId;
use guild_domain::message::Message;
use guild_domain::skill::SkillsChanged;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

pub const MESSAGE_CREATED: &str = "message-created";
pub const ACTIVITY_CHANGED: &str = "activity-changed";
pub const STATE_CHANGED: &str = "state-changed";
pub const SKILLS_CHANGED: &str = "skills-changed";
pub const SKILL_LIBRARY_CHANGED: &str = "skill-library-changed";
pub const DELEGATION_CHANGED: &str = "delegation-changed";

pub struct TauriEventPublisher {
    app: AppHandle,
}

impl TauriEventPublisher {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }

    fn emit<S: Serialize + Clone>(&self, name: &str, payload: S) {
        if let Err(error) = self.app.emit(name, payload) {
            log::warn!("イベント {name} を送れませんでした: {error}");
        }
    }
}

impl EventPublisher for TauriEventPublisher {
    fn message_created(&self, message: &Message) {
        self.emit(MESSAGE_CREATED, message);
    }

    fn activity_changed(&self, state: &ActivityState) {
        self.emit(ACTIVITY_CHANGED, state);
    }

    fn state_changed(&self) {
        self.emit(STATE_CHANGED, ());
    }

    fn skills_changed(&self, agent: &AgentId) {
        self.emit(SKILLS_CHANGED, SkillsChanged { agent_id: agent.clone() });
    }

    fn skill_library_changed(&self) {
        self.emit(SKILL_LIBRARY_CHANGED, ());
    }

    fn delegation_changed(&self, delegation: &Delegation) {
        self.emit(DELEGATION_CHANGED, delegation);
    }
}
