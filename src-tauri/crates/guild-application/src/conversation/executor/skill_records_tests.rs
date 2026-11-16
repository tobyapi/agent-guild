use super::*;

#[test]
fn duplicate_calls_within_posts_and_reordered_or_missing_events_are_not_trusted() {
    let records = SkillRecords::new("run", "agent", "Worker");
    let posts = Arc::new(Mutex::new(Vec::new()));
    let output = posts.clone();
    let sink = records.sink(Box::new(move |event| output.lock().push(event)));
    sink(RunUpdate::SkillRead("first".into(), "backend:a".into(), 1));
    sink(RunUpdate::SkillRead("first".into(), "backend:a".into(), 1));
    sink(RunUpdate::Post("progress".into()));
    sink(RunUpdate::SkillRead("first".into(), "backend:a".into(), 2));
    sink(RunUpdate::SkillRead("second".into(), "backend:b".into(), 4));
    sink(RunUpdate::SkillRead("third".into(), "backend:c".into(), 3));
    let final_usage = records.finish();
    assert_eq!(final_usage.loaded, ["first", "second", "third"]);
    assert!(final_usage.interval.unwrap().incomplete);
    let saved = posts.lock();
    let RunUpdate::RecordedPost(_, usage) = &saved[0] else { panic!("post") };
    assert_eq!(usage.loaded, ["first"]);
    assert_eq!(usage.interval.as_ref().unwrap().observations.len(), 1);
    assert_eq!(usage.interval.as_ref().unwrap().observations[0].tool_call_id, "backend:a");
}

#[test]
fn call_ids_are_scoped_to_the_source_interval_and_run() {
    for run in ["parent", "child"] {
        let records = SkillRecords::new(run, "agent", "Worker");
        let sink = records.sink(Box::new(|_| {}));
        sink(RunUpdate::SkillRead("first".into(), "backend:shared".into(), 1));
        sink(RunUpdate::Post("progress".into()));
        sink(RunUpdate::SkillRead("first".into(), "backend:shared".into(), 2));
        sink(RunUpdate::SkillRead("first".into(), "backend:shared".into(), 2));
        sink(RunUpdate::SkillRead("second".into(), "host:shared".into(), 3));
        let usage = records.finish();
        assert_eq!(usage.loaded, ["first", "second"]);
        let interval = usage.interval.unwrap();
        assert_eq!((interval.start, interval.end), (1, 3));
        assert!(!interval.incomplete);
        assert_eq!(interval.observations.len(), 2);
        assert_eq!(usage.run_id.as_deref(), Some(run));
    }
}

#[test]
fn ignored_posts_preserve_reads_until_real_post_and_final_is_separate() {
    let records = SkillRecords::new("run", "agent", "Worker");
    let posts = Arc::new(Mutex::new(Vec::new()));
    let output = posts.clone();
    let sink = records.sink(Box::new(move |update| output.lock().push(update)));
    sink(RunUpdate::SkillObservation(None));
    sink(RunUpdate::SkillObservation(Some("clean-code".into())));
    let footer = "```skill-usage\n[\"reflection\"]\n```";
    for text in [" ".into(), "Worker: [PASS]".into(), format!("[PASS]\n{footer}"), footer.into()] {
        sink(RunUpdate::Post(text));
    }
    assert!(posts.lock().is_empty());
    sink(RunUpdate::Post("progress".into()));
    {
        let saved = posts.lock();
        let RunUpdate::RecordedPost(_, usage) = &saved[0] else { panic!("recorded post") };
        assert_eq!(usage.loaded, ["clean-code"]);
        let interval = usage.interval.as_ref().unwrap();
        assert_eq!((interval.start, interval.end), (0, 1));
    }
    sink(RunUpdate::SkillObservation(Some("reflection".into())));
    let final_usage = records.finish();
    assert_eq!(final_usage.loaded, ["reflection"]);
    assert_eq!(final_usage.interval.as_ref().unwrap().start, 1);
    sink(RunUpdate::SkillObservation(Some("late".into())));
    sink(RunUpdate::Post("late post".into()));
    assert_eq!(posts.lock().len(), 1);
    assert!(records.finish().loaded.is_empty());
}

#[test]
fn rejected_save_snapshot_cannot_leak_into_next_post() {
    let records = SkillRecords::new("run", "agent", "Worker");
    let posts = Arc::new(Mutex::new(Vec::new()));
    let output = posts.clone();
    let sink = records.sink(Box::new(move |event| output.lock().push(event)));
    sink(RunUpdate::SkillObservation(Some("first".into())));
    sink(RunUpdate::Post("failed save".into()));
    let failed = posts.lock().pop().unwrap();
    sink(RunUpdate::SkillObservation(Some("next".into())));
    sink(RunUpdate::Post("different post".into()));
    let saved = posts.lock();
    let RunUpdate::RecordedPost(_, next) = &saved[0] else { panic!("recorded post") };
    assert_eq!(next.loaded, ["next"]);
    let RunUpdate::RecordedPost(_, retry) = failed else { panic!("recorded post") };
    assert_eq!(retry.loaded, ["first"], "a retry must reuse its original immutable snapshot");
}

#[test]
fn parallel_runs_and_child_jobs_have_independent_intervals() {
    let runs: Vec<_> =
        (0..4).map(|i| SkillRecords::new(&format!("run-{i}"), &format!("agent-{i}"), "Worker")).collect();
    std::thread::scope(|scope| {
        for (i, records) in runs.iter().enumerate() {
            scope.spawn(move || {
                let sink = records.sink(Box::new(|_| {}));
                for _ in 0..10 {
                    sink(RunUpdate::SkillObservation(Some(format!("skill-{i}"))));
                }
            });
        }
    });
    for (i, records) in runs.iter().enumerate() {
        let usage = records.finish();
        assert_eq!(usage.loaded, [format!("skill-{i}")]);
        assert_eq!(usage.run_id, Some(format!("run-{i}")));
        assert_eq!(usage.interval.as_ref().unwrap().agent_id, format!("agent-{i}"));
        assert_eq!(usage.interval.as_ref().unwrap().end, 10);
    }
}

#[test]
fn overflowed_records_mark_the_interval_incomplete() {
    let records = SkillRecords::new("run", "agent", "Worker");
    let sink = records.sink(Box::new(|_| {}));
    for i in 0..35 {
        sink(RunUpdate::SkillObservation(Some(format!("skill-{i}"))));
    }
    let usage = records.finish();
    assert_eq!(usage.loaded.len(), 32);
    assert!(usage.interval.as_ref().unwrap().incomplete);
}
