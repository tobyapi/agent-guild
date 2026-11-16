//! 1実行だけの観測を次の投稿区間へ消費する。全投稿への累積転記はしない。
use crate::ports::{RunUpdate, UpdateSink};
use guild_domain::skill_usage::{valid_name, SkillUsage};
use parking_lot::Mutex;
use std::sync::Arc;

pub(super) struct SkillRecords(Arc<Mutex<SkillUsage>>);
impl SkillRecords {
    pub(super) fn new(run_id: &str) -> Self {
        Self(Arc::new(Mutex::new(SkillUsage { run_id: Some(run_id.to_owned()), ..Default::default() })))
    }
    pub(super) fn sink(&self, next: UpdateSink) -> UpdateSink {
        let record = self.0.clone();
        Box::new(move |event| match event {
            RunUpdate::SkillObservation(name) => {
                let mut usage = record.lock();
                usage.supported = true;
                if let Some(name) = name.filter(|n| valid_name(n)) {
                    if usage.loaded.len() < 32 && !usage.loaded.contains(&name) {
                        usage.loaded.push(name);
                    }
                }
            }
            RunUpdate::Post(text) => {
                let usage = take(&mut record.lock());
                next(RunUpdate::RecordedPost(text, usage));
            }
            other => next(other),
        })
    }
    pub(super) fn take(&self) -> SkillUsage {
        take(&mut self.0.lock())
    }
}
fn take(record: &mut SkillUsage) -> SkillUsage {
    SkillUsage {
        declared: Vec::new(),
        loaded: std::mem::take(&mut record.loaded),
        supported: record.supported,
        run_id: record.run_id.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn reads_are_consumed_once_and_isolated_by_run() {
        let a = SkillRecords::new("a");
        let b = SkillRecords::new("b");
        let posts = Arc::new(Mutex::new(Vec::new()));
        let output = posts.clone();
        let sink = a.sink(Box::new(move |update| output.lock().push(update)));
        sink(RunUpdate::SkillObservation(None));
        for name in ["clean-code", "reflection", "clean-code", "<invalid>"] {
            sink(RunUpdate::SkillObservation(Some(name.into())));
        }
        sink(RunUpdate::Post("progress".into()));
        let saved = posts.lock();
        let RunUpdate::RecordedPost(_, usage) = &saved[0] else { panic!("expected recorded post") };
        assert_eq!(usage.loaded, ["clean-code", "reflection"]);
        assert_eq!(usage.run_id.as_deref(), Some("a"));
        assert!(usage.supported);
        assert!(a.take().loaded.is_empty());
        assert!(b.take().loaded.is_empty());
        assert!(!b.take().supported);
        sink(RunUpdate::SkillObservation(Some("final".into())));
        assert_eq!(a.take().loaded, ["final"]);
    }
}
