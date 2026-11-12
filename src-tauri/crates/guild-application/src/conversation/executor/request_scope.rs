//! チャンネルの範囲ごとの権限・作業場所・メモ・会話の境界。
use crate::error::{AppError, AppResult};
use crate::ports::WorkspacePaths;
use crate::services::Ports;
use guild_domain::agent::{effective_permissions, Agent, Permissions};
use guild_domain::backend::{BackendInfo, FolderScope};
use guild_domain::channel::{Channel, WorkspaceMode};
use guild_domain::conversation::JobSpec;
use guild_domain::locale;
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

/// 指定フォルダの範囲を、バックエンドがどう守るか（アダプタの申告。実際に守れる PC かは、アダプタが実行時に確かめる）
fn folder_scope(backend: Option<&BackendInfo>) -> AppResult<FolderScope> {
    let Some(info) = backend else {
        return Err(AppError::validation(locale::pick([
            "バックエンドの状態を確認できないため、指定フォルダでは実行できません",
            "Can't run in the designated folder because the backend status could not be checked.",
            "无法确认后端状态，因此不能在指定文件夹中执行。",
            "無法確認後端狀態，因此不能在指定資料夾中執行。",
            "백엔드 상태를 확인할 수 없어 지정 폴더에서 실행할 수 없습니다.",
        ])));
    };
    info.folder_scope.ok_or_else(|| {
        let label = &info.label;
        AppError::validation(locale::pick([
            format!("{label} は範囲を守れないため、指定フォルダのチャンネルでは実行できません。指定フォルダに対応したバックエンドのエージェントを使ってください"),
            format!("{label} can't keep to the designated folder, so it can't run in this channel. Use an agent whose backend supports designated folders."),
            format!("{label} 无法限制在指定范围内，因此不能在指定文件夹的频道中执行。请使用支持指定文件夹的后端的智能体。"),
            format!("{label} 無法限制在指定範圍內，因此不能在指定資料夾的頻道中執行。請使用支援指定資料夾的後端的代理人。"),
            format!("{label}은(는) 범위를 지킬 수 없어 지정 폴더 채널에서 실행할 수 없습니다. 지정 폴더를 지원하는 백엔드의 에이전트를 사용하세요."),
        ]))
    })
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
    let scoped = channel.workspace.mode != WorkspaceMode::Shared;
    let writable_dirs = if channel.workspace.mode == WorkspaceMode::Folder {
        let support = folder_scope(backend)?;
        for scoped in [&mut permissions, &mut usable] {
            scoped.read_anywhere = false;
            scoped.write_anywhere = false;
            scoped.skills = false;
            // 道具ごとに確かめるバックエンドでは、コマンドがハードリンクと相談相手のメモの確認をすり抜けるので使わせない。
            // シェルごと隔離に入れるバックエンドでは、コマンドも同じ範囲の中でだけ動く
            if support == FolderScope::Files {
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
pub(super) fn with_scope(system_prompt: String, channel: &Channel, backend: Option<&BackendInfo>) -> String {
    system_prompt + &prompt(channel, backend)
}

fn prompt(channel: &Channel, backend: Option<&BackendInfo>) -> String {
    if channel.workspace.mode != WorkspaceMode::Folder {
        return String::new();
    }
    let commands = match folder_scope(backend) {
        Ok(FolderScope::Sandbox) => {
            "コマンドはこの範囲の中でだけ動きます（範囲の外は読めず、書けません）。スキルはこのモードでは使えません。"
        }
        _ => "コマンド実行とスキルはこのモードでは使えません（リンクと相談相手のメモの制限を守るため）。",
    };
    format!(
        "\n## このチャンネルの作業範囲\n割り当てフォルダ: {}\n読み書きはこのフォルダとチャンネル専用の作業場所、読み取りは相談相手の成果物とこのチャンネルの添付にも許可されます。Web権限は別です。MEMORY.mdにはこのチャンネルの作業内容を記録してください。エージェント共通の作業場所のメモは渡されません。{commands}\n",
        channel.workspace.folder.as_deref().unwrap_or("")
    )
}
