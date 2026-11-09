//! 自発活動の判定（design.md §10）。

use guild_domain::agent::Agent;
use guild_domain::autonomy::{autonomy_channel, is_autonomy_due, jitter_ms};
use guild_domain::ids::ChannelId;

use super::support::{agent, channel};

const MINUTE: i64 = 60_000;
const STARTED_AT: i64 = 10_000_000;

fn autonomous_worker(interval_min: u32) -> Agent {
    let mut worker = agent("haru", "worker", "ハル");
    worker.autonomy_enabled = true;
    worker.autonomy_interval_min = interval_min;
    worker
}

#[test]
fn jitter_is_stable_and_under_a_minute() {
    let worker = autonomous_worker(10);
    assert_eq!(jitter_ms(&worker.id), jitter_ms(&worker.id));
    assert!((0..60_000).contains(&jitter_ms(&worker.id)));
}

#[test]
fn counts_from_app_start_plus_the_jitter() {
    let worker = autonomous_worker(10);
    let due_at = STARTED_AT + 10 * MINUTE + jitter_ms(&worker.id);
    assert!(!is_autonomy_due(&worker, due_at - 1, STARTED_AT));
    assert!(is_autonomy_due(&worker, due_at, STARTED_AT));
}

#[test]
fn the_base_is_the_later_of_the_last_run_and_app_start() {
    let mut worker = autonomous_worker(10);
    let jitter = jitter_ms(&worker.id);
    worker.last_autonomous_at = Some(STARTED_AT - 30 * MINUTE);
    assert!(!is_autonomy_due(&worker, STARTED_AT + 5 * MINUTE, STARTED_AT), "起動直後に一斉に動かない");
    worker.last_autonomous_at = Some(STARTED_AT + 5 * MINUTE);
    assert!(!is_autonomy_due(&worker, STARTED_AT + 10 * MINUTE + jitter, STARTED_AT));
    assert!(is_autonomy_due(&worker, STARTED_AT + 15 * MINUTE + jitter, STARTED_AT));
}

#[test]
fn any_enabled_active_agent_acts_on_its_own() {
    let late = STARTED_AT + 600 * MINUTE;
    let mut disabled = autonomous_worker(10);
    disabled.autonomy_enabled = false;
    assert!(!is_autonomy_due(&disabled, late, STARTED_AT));
    let mut deleted = autonomous_worker(10);
    deleted.deleted_at = Some(1);
    assert!(!is_autonomy_due(&deleted, late, STARTED_AT));
    let mut consultant = agent("logica", "expert", "ロジカ");
    assert!(!is_autonomy_due(&consultant, late, STARTED_AT), "既定は無効");
    consultant.autonomy_enabled = true;
    assert!(is_autonomy_due(&consultant, late, STARTED_AT), "テンプレートに関係なく誰でも動ける");
}

#[test]
fn prefers_the_configured_channel_when_the_agent_is_a_member() {
    let channels = vec![channel("c1", &["me", "haru"]), channel("c2", &["me", "haru"])];
    let mut worker = autonomous_worker(10);
    worker.autonomy_channel_id = Some(ChannelId::new("c2"));
    assert_eq!(autonomy_channel(&worker, &channels).map(|c| c.id.as_str()), Some("c2"));
}

#[test]
fn falls_back_to_the_first_joined_channel_or_none() {
    let channels = vec![channel("c1", &["me"]), channel("c2", &["me", "haru"]), channel("c3", &["me", "haru"])];
    let mut worker = autonomous_worker(10);
    worker.autonomy_channel_id = Some(ChannelId::new("c1"));
    assert_eq!(autonomy_channel(&worker, &channels).map(|c| c.id.as_str()), Some("c2"));
    worker.autonomy_channel_id = Some(ChannelId::new("deleted"));
    assert_eq!(autonomy_channel(&worker, &channels).map(|c| c.id.as_str()), Some("c2"));
    assert!(autonomy_channel(&worker, &channels[..1]).is_none());
}
