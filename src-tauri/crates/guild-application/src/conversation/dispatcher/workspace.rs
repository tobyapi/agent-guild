//! チャンネルの作業場所（共有・チャンネル専用・指定フォルダ）の変更。作業中の変更は断る（アクターの中で判定する）。

use guild_domain::channel::{Channel, ChannelWorkspace, WorkspaceMode};
use guild_domain::ids::ChannelId;
use guild_domain::locale;

use super::actor::Actor;
use crate::conversation::posting;
use crate::error::{AppError, AppResult};
use crate::ports::MessageFilter;

impl Actor {
    pub(super) fn configure_workspace(
        &self,
        id: &ChannelId,
        mode: WorkspaceMode,
        folder: Option<String>,
    ) -> AppResult<Channel> {
        if self.state.jobs().any(|job| &job.channel_id == id)
            || self.state.delegations.values().any(|tracked| &tracked.delegation.channel_id == id)
        {
            return Err(invalid(Problem::Busy));
        }
        let mut channel = posting::require_channel(&self.ports, id)?;
        let folder = match (mode, folder) {
            (WorkspaceMode::Folder, Some(folder)) if !folder.trim().is_empty() => {
                Some(self.ports.workspace.validate_folder(folder.trim())?)
            }
            (WorkspaceMode::Folder, _) => return Err(invalid(Problem::NoFolder)),
            (_, None) => None,
            _ => return Err(invalid(Problem::UnexpectedFolder)),
        };
        if channel.workspace.mode == mode && channel.workspace.folder == folder {
            return Ok(channel);
        }
        let after_seq =
            self.ports.messages.list(id, MessageFilter::All, None, 1)?.last().map_or(0, |message| message.seq);
        channel.workspace = ChannelWorkspace {
            mode,
            folder,
            after_seq,
            revision: channel.workspace.revision.checked_add(1).ok_or_else(|| invalid(Problem::TooManyChanges))?,
        };
        self.ports.channels.set_workspace(&channel.id, &channel.workspace)?;
        self.ports.events.state_changed();
        Ok(channel)
    }
}

/// 作業場所を変えられない理由
enum Problem {
    Busy,
    NoFolder,
    UnexpectedFolder,
    TooManyChanges,
}

fn invalid(problem: Problem) -> AppError {
    let texts = match problem {
        Problem::Busy => [
            "作業フォルダを変更する前に、このチャンネルの作業を停止してください",
            "Stop the work in this channel before changing its work folder.",
            "更改工作文件夹前，请先停止此频道中的工作。",
            "變更工作資料夾前，請先停止此頻道中的工作。",
            "작업 폴더를 바꾸기 전에 이 채널의 작업을 중지하세요.",
        ],
        Problem::NoFolder => [
            "割り当てるフォルダを指定してください",
            "Choose a folder to assign.",
            "请指定要分配的文件夹。",
            "請指定要指派的資料夾。",
            "지정할 폴더를 선택하세요.",
        ],
        Problem::UnexpectedFolder => [
            "フォルダモード以外では割り当てを空にしてください",
            "Leave the folder empty unless the folder mode is selected.",
            "非文件夹模式时，请将分配的文件夹留空。",
            "非資料夾模式時，請將指派的資料夾留空。",
            "폴더 모드가 아니면 지정 폴더를 비워 두세요.",
        ],
        Problem::TooManyChanges => [
            "作業場所の更新回数が上限に達しました",
            "The workspace has been changed too many times.",
            "工作区的更新次数已达上限。",
            "工作區的更新次數已達上限。",
            "작업 공간 변경 횟수가 한도에 도달했습니다.",
        ],
    };
    AppError::validation(locale::pick(texts))
}
