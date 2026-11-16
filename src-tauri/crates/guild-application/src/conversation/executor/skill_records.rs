//! 実行内の投稿前観測。投稿対象になった区間は失敗しても次投稿へ流さない。
use crate::ports::{RunUpdate, UpdateSink};
use guild_domain::conversation::format_reply;
use guild_domain::skill_usage::{declaration, valid_name, SkillInterval, SkillUsage};
use parking_lot::Mutex;
use std::sync::Arc;

struct Record {
    usage: SkillUsage,
    agent_name: String,
    closed: bool,
}
pub(super) struct SkillRecords(Arc<Mutex<Record>>);
impl SkillRecords {
    pub(super) fn new(run_id: &str, agent_id: &str, agent_name: &str) -> Self {
        let interval = SkillInterval { version: 1, agent_id: agent_id.into(), start: 0, end: 0, incomplete: false };
        Self(Arc::new(Mutex::new(Record {
            usage: SkillUsage { run_id: Some(run_id.into()), interval: Some(interval), ..Default::default() },
            agent_name: agent_name.into(),
            closed: false,
        })))
    }
    pub(super) fn sink(&self, next: UpdateSink) -> UpdateSink {
        let record = self.0.clone();
        Box::new(move |event| {
            let mut record = record.lock();
            if record.closed {
                return;
            }
            match event {
                RunUpdate::SkillObservation(name) => observe(&mut record.usage, name),
                RunUpdate::Post(text) => {
                    if format_reply(&declaration(&text).0, &record.agent_name).is_some() {
                        next(RunUpdate::RecordedPost(text, take(&mut record.usage)));
                    }
                }
                other => next(other),
            }
        })
    }
    pub(super) fn finish(&self) -> SkillUsage {
        let mut record = self.0.lock();
        record.closed = true;
        take(&mut record.usage)
    }
}
fn observe(usage: &mut SkillUsage, name: Option<String>) {
    usage.supported = true;
    let Some(name) = name else { return };
    if let Some(interval) = &mut usage.interval {
        interval.end += 1;
        interval.incomplete |= !valid_name(&name) || (usage.loaded.len() >= 32 && !usage.loaded.contains(&name));
    }
    if valid_name(&name) && usage.loaded.len() < 32 && !usage.loaded.contains(&name) {
        usage.loaded.push(name);
    }
}
fn take(record: &mut SkillUsage) -> SkillUsage {
    let result = SkillUsage { loaded: std::mem::take(&mut record.loaded), ..record.clone() };
    if let Some(interval) = &mut record.interval {
        interval.start = interval.end;
        interval.incomplete = false;
    }
    result
}

#[cfg(test)]
#[path = "skill_records_tests.rs"]
mod tests;
