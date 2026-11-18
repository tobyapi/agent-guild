//! エージェント共通の権限・作業場所・メモと、旧版で保存した会話の境界。
use crate::error::AppResult;
use crate::ports::WorkspacePaths;
use crate::services::Ports;
use guild_domain::agent::{effective_permissions, Agent, Permissions};
use guild_domain::backend::BackendInfo;
use guild_domain::channel::Channel;
use guild_domain::conversation::JobSpec;

pub(super) struct RunScope {
    /// ランナーに渡す権限: 役割の権限（バックエンドやチャンネルでは変わらない）。
    /// 守れない操作を取り除くのはアダプタ（渡した権限を超えることはしない）
    pub permissions: Permissions,
    /// そのうち、このバックエンドが実際に使える操作（プロンプトの「できること」とスキルの準備に使う）
    pub usable: Permissions,
    pub paths: WorkspacePaths,
    pub memory: String,
}

pub(super) fn accepts_job(ports: &Ports, job: &JobSpec, channel: &Channel) -> AppResult<bool> {
    if channel.workspace.revision > 0 {
        for root in job.conversations() {
            if ports.messages.get(root)?.is_some_and(|m| m.seq <= channel.workspace.after_seq) {
                return Ok(false);
            }
        }
    }
    Ok(true)
}

pub(super) fn prepare(ports: &Ports, agent: &Agent, backend: Option<&BackendInfo>) -> RunScope {
    let permissions = agent.behavior().permissions;
    let usable = effective_permissions(agent, backend);
    let paths = ports.workspace.run_paths(&agent.id, &agent.backend);
    let memory = ports.workspace.read_memory(&agent.id).unwrap_or_else(|error| {
        log::warn!("{} の MEMORY.md を読めませんでした: {error}", agent.name);
        String::new()
    });
    RunScope { permissions, usable, paths, memory }
}
