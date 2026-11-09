//! 自発活動の判定（design.md §10）。

use super::agent::Agent;
use super::author::MemberId;
use super::channel::Channel;
use super::ids::AgentId;

const MS_PER_MINUTE: i64 = 60_000;
const JITTER_SECONDS: u32 = 60;

/// 期限が来ているか: 自発活動が有効な（削除されていない）エージェントについて、
/// `基準 = max(lastAutonomousAt ?? 0, アプリ起動時刻)` として `now >= 基準 + 間隔 + 揺らぎ`
pub fn is_autonomy_due(agent: &Agent, now_ms: i64, app_started_at: i64) -> bool {
    if !agent.is_active() || !agent.behavior().autonomy_enabled {
        return false;
    }
    let base = agent.last_autonomous_at.unwrap_or(0).max(app_started_at);
    let interval = i64::from(agent.autonomy_interval_min) * MS_PER_MINUTE;
    now_ms >= base + interval + jitter_ms(&agent.id)
}

/// エージェント ID から決まる 0〜59 秒の揺らぎ（同じ間隔のエージェントが一斉に動かないように）
pub fn jitter_ms(id: &AgentId) -> i64 {
    let hash = id.as_str().bytes().fold(0_u32, |hash, byte| hash.wrapping_mul(31).wrapping_add(u32::from(byte)));
    i64::from(hash % JITTER_SECONDS) * 1000
}

/// 投稿先: autonomyChannelId（存在してメンバーなら）→ 参加している最初のチャンネル → なし
pub fn autonomy_channel<'a>(agent: &Agent, channels: &'a [Channel]) -> Option<&'a Channel> {
    let member = MemberId::Agent(agent.id.clone());
    let preferred = agent
        .autonomy_channel_id
        .as_ref()
        .and_then(|id| channels.iter().find(|c| &c.id == id && c.has_member(&member)));
    preferred.or_else(|| channels.iter().find(|c| c.has_member(&member)))
}
