//! 終了で中断された返答の知らせ（design.md §6）。待機と実行中のジョブはメモリにしかないので、アクターが
//! その要約を meta に保存しておき（dispatcher/inflight.rs）、次の起動で会話（起点）ごとにお知らせを出して消す。

use guild_domain::conversation::{notices, JobSpec};
use guild_domain::ids::{AgentId, ChannelId, MessageId};
use serde_json::{json, Value};

use super::posting::{self, Origin};
use crate::error::AppResult;
use crate::services::Ports;

/// 要約を置く meta の鍵
pub(crate) const KEY: &str = "interrupted_jobs";
/// 中断されるジョブがないときの要約
pub(crate) const EMPTY: &str = "[]";

/// ジョブの要約（積んだ順の JSON 配列）。合流したジョブは関わる会話ごとに1項目（きっかけの順）。
/// 自発活動など会話のないジョブは入れない
pub(crate) fn encode<'a>(jobs: impl Iterator<Item = &'a JobSpec>) -> String {
    let mut entries: Vec<Value> = Vec::new();
    for job in jobs {
        let mut roots: Vec<&MessageId> = Vec::new();
        for root in job.triggers.iter().map(|trigger| &trigger.root_id).chain(job.root_id.iter()) {
            if !roots.contains(&root) {
                roots.push(root);
            }
        }
        entries.extend(roots.into_iter().map(|root| {
            json!({
                "channelId": job.channel_id.as_str(),
                "rootId": root.as_str(),
                "depth": job.depth.saturating_sub(1),
                "agentId": job.agent_id.as_str(),
            })
        }));
    }
    Value::Array(entries).to_string()
}

/// 起動時（まだジョブを積む前）: 前回の終了で中断された返答を会話ごとに知らせ、要約を消す
pub(crate) fn announce(ports: &Ports) {
    let saved = match ports.meta.get(KEY) {
        Ok(Some(saved)) => saved,
        Ok(None) => return,
        Err(error) => {
            log::warn!("中断された返答の記録を読めませんでした: {error}");
            return;
        }
    };
    for (origin, agents) in conversations(&saved) {
        if let Err(error) = notify(ports, &origin, &agents) {
            log::warn!("中断された返答のお知らせを出せませんでした: {error}");
        }
    }
    if let Err(error) = ports.meta.set(KEY, EMPTY) {
        log::warn!("中断された返答の記録を消せませんでした: {error}");
    }
}

/// 会話ごとの、お知らせの位置（depth は最大）と中断されたエージェント（積んだ順・重複なし）。読めない項目は飛ばす
fn conversations(saved: &str) -> Vec<(Origin, Vec<AgentId>)> {
    let entries: Vec<Value> = serde_json::from_str(saved).unwrap_or_default();
    let mut groups: Vec<(Origin, Vec<AgentId>)> = Vec::new();
    for entry in &entries {
        let text = |key: &str| entry.get(key).and_then(Value::as_str);
        let (Some(channel), Some(root), Some(agent)) = (text("channelId"), text("rootId"), text("agentId")) else {
            continue;
        };
        let depth =
            entry.get("depth").and_then(Value::as_u64).map_or(0, |depth| u32::try_from(depth).unwrap_or(u32::MAX));
        let agent = AgentId::new(agent);
        let same = |origin: &Origin| origin.channel_id.as_str() == channel && origin.root_id.as_str() == root;
        match groups.iter_mut().find(|(origin, _)| same(origin)) {
            Some((origin, agents)) => {
                origin.depth = origin.depth.max(depth);
                if !agents.contains(&agent) {
                    agents.push(agent);
                }
            }
            None => {
                let origin = Origin { channel_id: ChannelId::new(channel), root_id: MessageId::new(root), depth };
                groups.push((origin, vec![agent]));
            }
        }
    }
    groups
}

/// チャンネルが残っていて、まだいるエージェントがいれば、その名前でお知らせを出す
fn notify(ports: &Ports, origin: &Origin, agents: &[AgentId]) -> AppResult<()> {
    if ports.channels.get(&origin.channel_id)?.is_none() {
        return Ok(());
    }
    let all = ports.agents.list()?;
    let names: Vec<String> = agents
        .iter()
        .filter_map(|id| all.iter().find(|agent| &agent.id == id).map(|agent| agent.name.clone()))
        .collect();
    if !names.is_empty() {
        posting::post_notice(ports, origin, &notices::interrupted(&names))?;
    }
    Ok(())
}
