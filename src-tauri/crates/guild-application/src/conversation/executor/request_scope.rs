//! チャンネルの範囲ごとの実効権限・作業場所・メモ・会話の境界。
use crate::error::{AppError, AppResult};
use crate::ports::WorkspacePaths;
use crate::services::Ports;
use guild_domain::agent::{effective_permissions, Agent, Permissions};
use guild_domain::backend::BackendInfo;
use guild_domain::channel::{Channel, WorkspaceMode};
use guild_domain::conversation::JobSpec;
use std::path::PathBuf;

pub(super) struct RunScope {
    pub permissions: Permissions,
    pub paths: WorkspacePaths,
    pub memory: String,
    pub writable_dirs: Option<Vec<PathBuf>>,
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

pub(super) fn prepare(
    ports: &Ports,
    agent: &Agent,
    channel: &Channel,
    backend: Option<&BackendInfo>,
) -> AppResult<RunScope> {
    let mut permissions = effective_permissions(agent, backend);
    let scoped = channel.workspace.mode != WorkspaceMode::Legacy || channel.workspace.revision > 0;
    let writable_dirs = if channel.workspace.mode == WorkspaceMode::Folder {
        if agent.backend == "claude" {
            return Err(AppError::validation(
                "Claudeのファイル操作は点検後のリンク差し替えを制限できないため、指定フォルダでは実行できません",
            ));
        }
        if agent.backend != "ollama" {
            return Err(AppError::validation(
                "このバックエンドはフォルダ制限にまだ対応していません。macOSのOllamaを選んでください",
            ));
        }
        permissions.read_anywhere = false;
        permissions.write_anywhere = false;
        permissions.skills = false;
        // Shell commands bypass per-file hardlink and private-memory checks.
        permissions.run_commands = false;
        let folder =
            channel.workspace.folder.as_ref().ok_or_else(|| AppError::validation("割り当てフォルダがありません"))?;
        Some(vec![PathBuf::from(folder)])
    } else {
        None
    };
    let paths = if scoped {
        ports.workspace.prepare_scoped(&agent.id, &agent.backend, &channel.id, &channel.workspace)?
    } else {
        ports.workspace.prepare(&agent.id, &agent.backend)?
    };
    let memory = if scoped {
        ports.workspace.read_scoped_memory(&agent.id, &channel.id, channel.workspace.revision)?
    } else {
        ports.workspace.read_memory(&agent.id).unwrap_or_else(|error| {
            log::warn!("{} の MEMORY.md を読めませんでした: {error}", agent.name);
            String::new()
        })
    };
    Ok(RunScope { permissions, paths, memory, writable_dirs })
}

pub(super) fn prompt(channel: &Channel) -> String {
    if channel.workspace.mode != WorkspaceMode::Folder {
        return String::new();
    }
    format!("\n## このチャンネルの作業範囲\n割り当てフォルダ: {}\n読み書きはこのフォルダとチャンネル専用の作業場所、読み取りは相談相手の成果物とこのチャンネルの添付にも許可されます。Web権限は別です。MEMORY.mdにはこのチャンネルの作業内容を記録してください。旧作業場所のメモは自動投入されません。コマンド実行とスキルはこのモードでは使えません（リンクと相談相手のメモの制限を守るため）。\n", channel.workspace.folder.as_deref().unwrap_or(""))
}
