//! React へのイベントを記録するフェイク。

use std::sync::atomic::{AtomicUsize, Ordering};

use guild_application::ports::EventPublisher;
use guild_domain::activity::ActivityState;
use guild_domain::delegation::Delegation;
use guild_domain::ids::AgentId;
use guild_domain::message::Message;
use parking_lot::Mutex;

#[derive(Default)]
pub struct FakeEvents {
    pub messages: Mutex<Vec<Message>>,
    pub activities: Mutex<Vec<ActivityState>>,
    pub state_changes: AtomicUsize,
    pub skills_changed: Mutex<Vec<AgentId>>,
    pub library_changes: AtomicUsize,
    /// delegation-changed のペイロード（届いた順）
    pub delegations: Mutex<Vec<Delegation>>,
}

impl EventPublisher for FakeEvents {
    fn message_created(&self, message: &Message) {
        self.messages.lock().push(message.clone());
    }
    fn activity_changed(&self, state: &ActivityState) {
        self.activities.lock().push(state.clone());
    }
    fn state_changed(&self) {
        self.state_changes.fetch_add(1, Ordering::SeqCst);
    }
    fn skills_changed(&self, agent: &AgentId) {
        self.skills_changed.lock().push(agent.clone());
    }
    fn skill_library_changed(&self) {
        self.library_changes.fetch_add(1, Ordering::SeqCst);
    }
    fn delegation_changed(&self, delegation: &Delegation) {
        self.delegations.lock().push(delegation.clone());
    }
}
