use guild_application::ports::{ChannelRepository, StatisticsRepository};
use guild_domain::channel::Channel;
use guild_domain::ids::ChannelId;
use guild_domain::statistics::{DelegationStatistics, RunMeasurement, RunUsage};

use super::{channels_messages::lobby, memory};
use crate::infrastructure::sqlite::{SqliteChannelRepository, SqliteStatisticsRepository};

#[test]
fn aggregates_all_delegations_and_runs_by_channel_and_model() {
    let db = memory();
    let channels = SqliteChannelRepository::new(db.clone());
    let c1 = ChannelId::new("c1");
    let c2 = ChannelId::new("c2");
    channels.insert(&lobby()).unwrap();
    channels.insert(&Channel { id: c2.clone(), name: "実験".to_owned(), ..lobby() }).unwrap();
    db.with(|conn| {
        conn.execute_batch(
            "WITH RECURSIVE ids(n) AS (VALUES(1) UNION ALL SELECT n + 1 FROM ids WHERE n < 202)
             INSERT INTO delegations SELECT 'd' || n, 'c1', 'manager', 'm' || n, 'done', NULL, 1, 2 FROM ids;
             INSERT INTO subtasks VALUES ('s1', 'd1', 0, 'worker', '', 'done', 'r1', NULL),
                 ('s2', 'd1', 1, 'worker', '', 'failed', 'error', NULL),
                 ('s3', 'd2', 0, 'worker', '', 'cancelled', NULL, NULL),
                 ('s4', 'd3', 0, 'worker', '', 'running', NULL, NULL);",
        )
    })
    .unwrap();
    let statistics = SqliteStatisticsRepository::new(db.clone());
    let before = statistics.for_channel(&c1).unwrap();
    assert_eq!(
        before.delegation,
        DelegationStatistics { delegations: 202, subtasks: 4, reported: 1, failed: 1, cancelled: 1, pending: 1 }
    );
    assert!(before.models.is_empty());

    let measured = example_measurement(c1.clone());
    let missing = RunMeasurement {
        job_id: "job-2".to_owned(),
        duration_ms: 750,
        usage: RunUsage { model: measured.usage.model.clone(), ..RunUsage::default() },
        ..measured.clone()
    };
    for run in [&measured, &measured, &missing] {
        statistics.record_run(run).unwrap();
    }
    statistics
        .record_run(&RunMeasurement { job_id: "job-3".to_owned(), channel_id: c2.clone(), ..measured.clone() })
        .unwrap();
    let totals = statistics.for_channel(&c1).unwrap();
    assert_eq!(totals.delegation, before.delegation);
    let model = &totals.models[0];
    assert_eq!((model.runs, model.total_duration_ms, model.token_runs, model.cost_runs), (2, 2000, 1, 1));
    assert_eq!(
        (model.input_tokens, model.output_tokens, model.estimated_cost_nano_usd),
        (Some(48), Some(0), Some(4000))
    );
    assert_eq!(statistics.for_channel(&c2).unwrap().models[0].runs, 1);
    channels.delete(&c1).unwrap();
    statistics.record_run(&measured).unwrap();
    assert!(statistics.for_channel(&c1).unwrap().models.is_empty());
}

fn example_measurement(channel: ChannelId) -> RunMeasurement {
    RunMeasurement {
        job_id: "job-1".to_owned(),
        channel_id: channel,
        backend: "claude".to_owned(),
        started_at: 2,
        duration_ms: 1250,
        usage: RunUsage {
            model: Some("sonnet".to_owned()),
            input_tokens: Some(48),
            output_tokens: Some(0),
            estimated_cost_nano_usd: Some(4000),
        },
    }
}
