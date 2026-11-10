//! 全期間の運用統計。チャットの割り振り一覧の表示上限とは独立して集計する。

use std::sync::Arc;

use guild_application::ports::StatisticsRepository;
use guild_application::AppResult;
use guild_domain::ids::ChannelId;
use guild_domain::statistics::{ChannelStatistics, DelegationStatistics, ModelStatistics, RunMeasurement};
use rusqlite::params;

use super::{codec::storage, Database};

const DELEGATION_TOTALS: &str = "
    SELECT COUNT(DISTINCT d.id), COUNT(s.id),
           COUNT(CASE WHEN s.status = 'done' AND s.result_message_id IS NOT NULL THEN 1 END),
           COUNT(CASE WHEN s.status = 'failed' THEN 1 END),
           COUNT(CASE WHEN s.status = 'cancelled' THEN 1 END),
           COUNT(CASE WHEN s.status IN ('pending', 'running') THEN 1 END)
    FROM delegations d LEFT JOIN subtasks s ON s.delegation_id = d.id
    WHERE d.channel_id = ?1";

const MODEL_TOTALS: &str = "
    SELECT backend, model, COUNT(*), SUM(duration_ms), SUM(input_tokens), SUM(output_tokens),
           COUNT(CASE WHEN input_tokens IS NOT NULL AND output_tokens IS NOT NULL THEN 1 END),
           SUM(estimated_cost_nano_usd), COUNT(estimated_cost_nano_usd)
    FROM run_measurements WHERE channel_id = ?1
    GROUP BY backend, model ORDER BY COUNT(*) DESC, backend, model";

pub struct SqliteStatisticsRepository {
    db: Arc<Database>,
}

impl SqliteStatisticsRepository {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }
}

impl StatisticsRepository for SqliteStatisticsRepository {
    fn record_run(&self, run: &RunMeasurement) -> AppResult<()> {
        let usage = &run.usage;
        self.db
            .with(|conn| {
                conn.execute(
                    "INSERT INTO run_measurements (job_id, channel_id, backend, model, started_at, duration_ms,
                    input_tokens, output_tokens, estimated_cost_nano_usd)
                 SELECT ?1, id, ?3, ?4, ?5, ?6, ?7, ?8, ?9 FROM channels WHERE id = ?2
                 ON CONFLICT (job_id) DO NOTHING",
                    params![
                        run.job_id,
                        run.channel_id.as_str(),
                        run.backend,
                        usage.model,
                        run.started_at,
                        run.duration_ms,
                        usage.input_tokens,
                        usage.output_tokens,
                        usage.estimated_cost_nano_usd
                    ],
                )?;
                Ok(())
            })
            .map_err(storage)
    }

    fn for_channel(&self, channel: &ChannelId) -> AppResult<ChannelStatistics> {
        self.db
            .with(|conn| {
                let delegation = conn.query_row(DELEGATION_TOTALS, [channel.as_str()], |row| {
                    Ok(DelegationStatistics {
                        delegations: row.get(0)?,
                        subtasks: row.get(1)?,
                        reported: row.get(2)?,
                        failed: row.get(3)?,
                        cancelled: row.get(4)?,
                        pending: row.get(5)?,
                    })
                })?;
                let models = conn
                    .prepare(MODEL_TOTALS)?
                    .query_map([channel.as_str()], |row| {
                        Ok(ModelStatistics {
                            backend: row.get(0)?,
                            model: row.get(1)?,
                            runs: row.get(2)?,
                            total_duration_ms: row.get(3)?,
                            input_tokens: row.get(4)?,
                            output_tokens: row.get(5)?,
                            token_runs: row.get(6)?,
                            estimated_cost_nano_usd: row.get(7)?,
                            cost_runs: row.get(8)?,
                        })
                    })?
                    .collect::<rusqlite::Result<_>>()?;
                Ok(ChannelStatistics { delegation, models })
            })
            .map_err(storage)
    }
}
