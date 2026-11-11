//! チャンネルの範囲ごとの権限・作業場所・メモ・会話の境界。
use crate::error::{AppError, AppResult};
use crate::ports::WorkspacePaths;
use crate::services::Ports;
use guild_domain::agent::{effective_permissions, Agent, Permissions};
use guild_domain::backend::BackendInfo;
use guild_domain::channel::{Channel, WorkspaceMode};
use guild_domain::conversation::JobSpec;
use std::path::PathBuf;

pub(super) struct RunScope {
    /// ランナーに渡す権限: 役割の権限（バックエンドでは変わらない）を、チャンネルの作業範囲で絞ったもの。
    /// 守れない操作を取り除くのはアダプタ（渡した権限を超えることはしない）
    pub permissions: Permissions,
    /// そのうち、このバックエンドが実際に使える操作（プロンプトの「できること」とスキルの準備に使う）
    pub usable: Permissions,
    pub paths: WorkspacePaths,
    pub memory: String,
    pub writable_dirs: Option<Vec<PathBuf>>,
}

/// 指定フォルダの範囲を、バックエンドがどう守るか（実際に守れる PC かは、ランナーのアダプタが実行時に確かめる）
#[derive(Clone, Copy, PartialEq, Eq)]
enum FolderSupport {
    /// ファイルの道具ごとに範囲を確かめ、OS の隔離の中で読み書きする（Ollama）。コマンドとスキルは使えない
    Files,
    /// シェルごと OS の隔離に入れ、権限プロファイルで読み書きの範囲を決める（Codex 系）。コマンドは隔離の中で使える
    Sandbox,
}

fn folder_support(backend: &str) -> AppResult<FolderSupport> {
    match backend {
        "ollama" => Ok(FolderSupport::Files),
        "codex" | "grok" | "muse" => Ok(FolderSupport::Sandbox),
        "claude" => Err(AppError::validation(
            "Claudeのファイル操作は点検後のリンク差し替えを制限できないため、指定フォルダでは実行できません",
        )),
        _ => Err(AppError::validation(
            "このバックエンドはフォルダ制限にまだ対応していません。OllamaかCodex系（Codex・Grok・Muse）を選んでください",
        )),
    }
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
    let mut permissions = agent.behavior().permissions;
    let mut usable = effective_permissions(agent, backend);
    let scoped = channel.workspace.mode != WorkspaceMode::Legacy || channel.workspace.revision > 0;
    let writable_dirs = if channel.workspace.mode == WorkspaceMode::Folder {
        let support = folder_support(&agent.backend)?;
        for scoped in [&mut permissions, &mut usable] {
            scoped.read_anywhere = false;
            scoped.write_anywhere = false;
            scoped.skills = false;
            // 道具ごとに確かめるバックエンドでは、コマンドがハードリンクと相談相手のメモの確認をすり抜けるので使わせない。
            // シェルごと隔離に入れるバックエンドでは、コマンドも同じ範囲の中でだけ動く
            if support == FolderSupport::Files {
                scoped.run_commands = false;
            }
        }
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
    Ok(RunScope { permissions, usable, paths, memory, writable_dirs })
}

/// システムプロンプトの末尾に、このチャンネルの作業範囲の説明を足す（指定フォルダのときだけ）
pub(super) fn with_scope(system_prompt: String, channel: &Channel, backend: &str) -> String {
    system_prompt + &prompt(channel, backend)
}

fn prompt(channel: &Channel, backend: &str) -> String {
    if channel.workspace.mode != WorkspaceMode::Folder {
        return String::new();
    }
    let commands = match folder_support(backend) {
        Ok(FolderSupport::Sandbox) => {
            "コマンドはこの範囲の中でだけ動きます（範囲の外は読めず、書けません）。スキルはこのモードでは使えません。"
        }
        _ => "コマンド実行とスキルはこのモードでは使えません（リンクと相談相手のメモの制限を守るため）。",
    };
    format!(
        "\n## このチャンネルの作業範囲\n割り当てフォルダ: {}\n読み書きはこのフォルダとチャンネル専用の作業場所、読み取りは相談相手の成果物とこのチャンネルの添付にも許可されます。Web権限は別です。MEMORY.mdにはこのチャンネルの作業内容を記録してください。旧作業場所のメモは自動投入されません。{commands}\n",
        channel.workspace.folder.as_deref().unwrap_or("")
    )
}
