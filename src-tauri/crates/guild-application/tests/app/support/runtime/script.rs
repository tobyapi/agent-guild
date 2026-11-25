use std::sync::Arc;

use guild_application::ports::{RunUpdate, RuntimeError};
use guild_domain::statistics::RunUsage;
use tokio::sync::Notify;

/// 1回分の返し方
pub enum Script {
    Reply(String),
    Fail(String),
    Measured(Vec<RunUsage>, Result<String, RuntimeError>),
    /// 中断されるまで返さない
    Hang,
    UpdatesThenCancel(Vec<RunUpdate>),
    /// gate が開くまで待ってから返す（中断されたら Cancelled）
    Gate(Arc<Notify>, String),
    /// 中断を無視して、gate が開いたら返す（中断が間に合わなかった実行）
    Stubborn(Arc<Notify>, String),
    /// 作業の途中の投稿を順に送ってから返す
    Posts(Vec<String>, String),
    Updates(Vec<RunUpdate>, String),
    PhasedUpdates(Vec<RunUpdate>, Arc<Notify>, Vec<RunUpdate>),
    /// 中断を無視して、gate が開いたら途中の投稿を送り、[PASS] を返す
    LatePost(Arc<Notify>, String),
}

pub fn reply(text: &str) -> Script {
    Script::Reply(text.to_owned())
}
