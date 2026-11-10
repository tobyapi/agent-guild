//! ランナーの時間と利用量を、返答や割り振りの成否に関係なく記録する。

use std::sync::Arc;
use std::time::Instant;

use guild_domain::ids::ChannelId;
use guild_domain::statistics::{RunMeasurement, RunUsage};
use parking_lot::Mutex;

use super::UpdateFn;
use crate::ports::{RunUpdate, RuntimeRequest, UpdateSink};
use crate::services::Ports;

pub(super) struct Measurement {
    record: RunMeasurement,
    usage: Arc<Mutex<RunUsage>>,
    start: Instant,
}

impl Measurement {
    pub(super) fn new(ports: &Ports, job_id: &str, channel: &ChannelId, request: &RuntimeRequest) -> Self {
        let model = (!request.model.is_empty()).then(|| request.model.clone());
        let record = RunMeasurement {
            job_id: job_id.to_owned(),
            channel_id: channel.clone(),
            backend: request.backend.clone(),
            started_at: ports.clock.now_ms(),
            duration_ms: 0,
            usage: RunUsage { model, ..RunUsage::default() },
        };
        Self { record, usage: Arc::default(), start: Instant::now() }
    }

    pub(super) fn sink(&self, update: UpdateFn) -> UpdateSink {
        let usage = self.usage.clone();
        Box::new(move |event| match event {
            RunUpdate::Usage(delta) => {
                let mut usage = usage.lock();
                if delta.model.is_some() {
                    usage.model = delta.model;
                }
                add(&mut usage.input_tokens, delta.input_tokens);
                add(&mut usage.output_tokens, delta.output_tokens);
                add(&mut usage.estimated_cost_nano_usd, delta.estimated_cost_nano_usd);
            }
            other => update(other),
        })
    }

    pub(super) fn save(mut self, ports: &Ports) {
        self.record.duration_ms = i64::try_from(self.start.elapsed().as_millis()).unwrap_or(i64::MAX);
        let mut usage = std::mem::take(&mut *self.usage.lock());
        usage.model = usage.model.or(self.record.usage.model);
        self.record.usage = usage;
        if let Err(error) = ports.statistics.record_run(&self.record) {
            log::warn!("運用統計を保存できませんでした: {error}");
        }
    }
}

fn add(total: &mut Option<i64>, delta: Option<i64>) {
    if let Some(delta) = delta {
        *total = Some(total.unwrap_or(0).saturating_add(delta));
    }
}
