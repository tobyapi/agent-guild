//! 終了で中断された返答の知らせ（design.md §6）。待機と実行中のジョブはメモリにしかないので、アクターが
//! その要約を meta に保存しておき（dispatcher/inflight.rs）、次の起動で会話（起点）ごとにお知らせを出して消す。

use crate::ports::InterruptedJob;
use guild_domain::conversation::{notices, JobSpec};
use guild_domain::ids::{AgentId, MessageId};
use guild_domain::locale;

use super::posting::{self, Origin};
use crate::error::AppResult;
use crate::services::Ports;

/// ジョブの要約（積んだ順の JSON 配列）。合流したジョブは関わる会話ごとに1項目（きっかけの順）。
/// 自発活動など会話のないジョブは入れない
pub(crate) fn encode<'a>(jobs: impl Iterator<Item = &'a JobSpec>) -> Vec<InterruptedJob> {
    let mut entries: Vec<InterruptedJob> = Vec::new();
    for job in jobs {
        let mut roots: Vec<&MessageId> = Vec::new();
        for root in job.triggers.iter().map(|trigger| &trigger.root_id).chain(job.root_id.iter()) {
            if !roots.contains(&root) {
                roots.push(root);
            }
        }
        entries.extend(roots.into_iter().map(|root| InterruptedJob {
            channel_id: job.channel_id.clone(),
            root_id: root.clone(),
            depth: job.depth.saturating_sub(1),
            agent_id: job.agent_id.clone(),
        }));
    }
    entries
}

/// 起動時（まだジョブを積む前）: 前回の終了で中断された返答を会話ごとに知らせ、要約を消す
pub(crate) fn announce(ports: &Ports) {
    let saved = match ports.guild_state.interrupted_jobs() {
        Ok(saved) => saved,
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
    if let Err(error) = ports.guild_state.replace_interrupted(&[]) {
        log::warn!("中断された返答の記録を消せませんでした: {error}");
    }
}

/// 会話ごとの、お知らせの位置（depth は最大）と中断されたエージェント（積んだ順・重複なし）。読めない項目は飛ばす
fn conversations(saved: &[InterruptedJob]) -> Vec<(Origin, Vec<AgentId>)> {
    let mut groups: Vec<(Origin, Vec<AgentId>)> = Vec::new();
    for entry in saved {
        let depth = entry.depth;
        let agent = entry.agent_id.clone();
        let same = |origin: &Origin| origin.channel_id == entry.channel_id && origin.root_id == entry.root_id;
        match groups.iter_mut().find(|(origin, _)| same(origin)) {
            Some((origin, agents)) => {
                origin.depth = origin.depth.max(depth);
                if !agents.contains(&agent) {
                    agents.push(agent);
                }
            }
            None => {
                let origin = Origin { channel_id: entry.channel_id.clone(), root_id: entry.root_id.clone(), depth };
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
        posting::post_notice(ports, origin, &notices::interrupted(locale::current(), &names))?;
    }
    Ok(())
}
