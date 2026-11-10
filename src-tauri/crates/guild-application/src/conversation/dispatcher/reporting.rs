//! 実行タスクからの報告（途中経過・途中の投稿・終わり）をコマンドにして受け取る。途中の投稿はここで保存する。

use super::actor::Actor;
use super::Command;
use crate::conversation::executor::{self, JobReporter};
use crate::ports::RunUpdate;

impl Actor {
    /// 実行タスクからの報告をコマンドとして受け取る
    pub(super) fn reporter(&self, job_id: &str) -> JobReporter {
        let (updates, finished) = (self.sender.clone(), self.sender.clone());
        let (update_id, finished_id) = (job_id.to_owned(), job_id.to_owned());
        JobReporter::new(
            move |update| {
                let job_id = update_id.clone();
                let command = match update {
                    RunUpdate::Activity(detail) => Command::Activity { job_id, detail },
                    RunUpdate::Post(text) => Command::Post { job_id, text },
                    RunUpdate::Usage(_) => return,
                };
                let _ = updates.send(command);
            },
            move |outcome| {
                let _ = finished.send(Command::Finished { job_id: finished_id, outcome });
            },
        )
    }

    /// 作業の途中の投稿: まだ実行中で、取り消されても世代が変わってもいなければ保存する（振り分けはしない）
    pub(super) fn post_progress(&self, job_id: &str, text: &str) {
        let Some(running) = self.state.running.get(job_id) else {
            return;
        };
        if !self.state.is_current(running) {
            return;
        }
        if let Err(error) = executor::post_progress(&self.ports, &running.job, text) {
            log::error!("途中の投稿を保存できませんでした: {error}");
        }
    }
}
