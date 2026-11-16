//! 実行内の投稿前観測。投稿対象になった区間は失敗しても次投稿へ流さない。
use crate::ports::{RunUpdate, UpdateSink};
use guild_domain::conversation::format_reply;
use guild_domain::skill_usage::{declaration, valid_name, SkillInterval, SkillRead, SkillUsage};
use parking_lot::Mutex;
use std::sync::Arc;

struct Record {
    usage: SkillUsage,
    agent_name: String,
    closed: bool,
    source_sequence: u64,
    calls: std::collections::HashMap<String, String>,
}
pub(super) struct SkillRecords(Arc<Mutex<Record>>);
impl SkillRecords {
    pub(super) fn new(run_id: &str, agent_id: &str, agent_name: &str) -> Self {
        let interval = SkillInterval {
            version: 2,
            agent_id: agent_id.into(),
            start: 0,
            end: 0,
            incomplete: false,
            observations: Vec::new(),
        };
        Self(Arc::new(Mutex::new(Record {
            usage: SkillUsage { run_id: Some(run_id.into()), interval: Some(interval), ..Default::default() },
            agent_name: agent_name.into(),
            closed: false,
            source_sequence: 0,
            calls: Default::default(),
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
                RunUpdate::SkillRead(name, call, seq) => observe_read(&mut record, name, call, seq),
                RunUpdate::Post(text) => {
                    if format_reply(&declaration(&text).0, &record.agent_name).is_some() {
                        next(RunUpdate::RecordedPost(text, take(&mut record)));
                    }
                }
                other => next(other),
            }
        })
    }
    pub(super) fn finish(&self) -> SkillUsage {
        let mut record = self.0.lock();
        record.closed = true;
        take(&mut record)
    }
}
fn observe_read(record: &mut Record, name: String, call: String, seq: u64) {
    let duplicate = record.calls.get(&call);
    if seq == record.source_sequence && duplicate == Some(&name) {
        return;
    }
    let invalid = seq != record.source_sequence + 1 || call.is_empty() || call.len() > 256;
    record.source_sequence = record.source_sequence.max(seq);
    if let Some(interval) = &mut record.usage.interval {
        interval.end = record.source_sequence;
    }
    if let Some(previous) = duplicate {
        if previous != &name || invalid {
            if let Some(interval) = &mut record.usage.interval {
                interval.incomplete = true;
            }
        }
        return;
    }
    observe(&mut record.usage, Some(name.clone()));
    if let Some(interval) = &mut record.usage.interval {
        interval.end = record.source_sequence;
        interval.incomplete |= invalid || record.calls.len() >= 4096;
        if !interval.incomplete {
            interval.observations.push(SkillRead { name: name.clone(), tool_call_id: call.clone(), sequence: seq });
        }
    }
    if record.calls.len() < 4096 {
        record.calls.insert(call, name);
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
fn take(record: &mut Record) -> SkillUsage {
    let result = SkillUsage { loaded: std::mem::take(&mut record.usage.loaded), ..record.usage.clone() };
    record.calls.clear();
    if let Some(interval) = &mut record.usage.interval {
        interval.start = interval.end;
        interval.incomplete = false;
        interval.observations.clear();
    }
    result
}

#[cfg(test)]
#[path = "skill_records_tests.rs"]
mod tests;
